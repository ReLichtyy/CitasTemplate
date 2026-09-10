const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const RUTA_REPORTE = '/telemetria/errores';

/** Deben coincidir con `EventoClienteDto` del backend: si se pasan, el reporte se pierde con un 400. */
export type TipoEventoCliente = 'render' | 'global' | 'promesa' | 'red' | 'api';
const LARGO_MENSAJE = 500;
const LARGO_TRAZA = 4_000;
const LARGO_COMPONENTE = 2_000;
const LARGO_RUTA = 200;

/**
 * Dos frenos, y los dos existen por el mismo caso: un error dentro de un `useEffect` que
 * vuelve a renderizar y a fallar. Sin freno, eso son cientos de peticiones por segundo
 * contra el propio API que se esta intentando diagnosticar.
 *
 * - **Dedupe**: el mismo error no se repite dentro de la ventana. La clave es tipo +
 *   mensaje, no la traza: la traza puede variar en cada render y romperia el dedupe.
 * - **Tope por carga de pagina**: pase lo que pase, no salen mas de estos. Se reinicia al
 *   recargar, que es justo cuando vuelve a interesar.
 */
const VENTANA_DEDUPE_MS = 60_000;
const TOPE_POR_CARGA = 20;

const enviados = new Map<string, number>();
let total = 0;

export interface EventoCliente {
  tipo: TipoEventoCliente;
  mensaje: string;
  traza?: string;
  componente?: string;
  /** El `x-request-id` de la peticion que fallo, cuando el fallo vino del API. */
  requestId?: string;
}

function recortar(texto: string | undefined, maximo: number): string | undefined {
  if (!texto) {
    return undefined;
  }
  return texto.length <= maximo ? texto : texto.slice(0, maximo);
}

/**
 * Manda un fallo del navegador al backend, donde queda en el mismo log estructurado que
 * todo lo demas. Nunca lanza: quien la llama esta en mitad de un error y no puede
 * permitirse un segundo.
 *
 * Devuelve el `x-request-id` que el servidor le puso al reporte, o `null` si no se mando
 * (dedupe, tope) o si no llego. Ese id es lo que la pantalla de fallo muestra como codigo:
 * con el, un "se rompio" del que mira la demo se convierte en una busqueda exacta en el
 * log. Esperar el id es opcional — la mayoria de los llamadores ignoran el resultado.
 *
 * Deliberadamente **no** usa `apiClient`: ese wrapper cierra la sesion ante un 401 y
 * traduce errores, y las dos cosas son peligrosas aqui. Un reporte que fallara dentro del
 * cliente podria disparar otro reporte, y eso es el bucle que estos frenos evitan. Aqui se
 * usa `fetch` pelado y todo fallo se traga.
 */
export async function reportarError(evento: EventoCliente): Promise<string | null> {
  try {
    if (total >= TOPE_POR_CARGA) {
      return null;
    }

    const clave = `${evento.tipo}:${evento.mensaje}`;
    const ahora = Date.now();
    const anterior = enviados.get(clave);
    if (anterior !== undefined && ahora - anterior < VENTANA_DEDUPE_MS) {
      return null;
    }
    enviados.set(clave, ahora);
    total += 1;

    const cuerpo = {
      tipo: evento.tipo,
      mensaje: recortar(evento.mensaje, LARGO_MENSAJE) ?? 'Error sin mensaje',
      traza: recortar(evento.traza, LARGO_TRAZA),
      componente: recortar(evento.componente, LARGO_COMPONENTE),
      requestId: evento.requestId,
      /**
       * Solo `pathname`. El `search` de esta app lleva el token de confirmacion de cita
       * (`/citas/confirmar?token=…`): mandarlo aqui lo dejaria escrito en el log del
       * servidor, que es exactamente donde no debe estar un token valido.
       */
      ruta: recortar(window.location.pathname, LARGO_RUTA),
    };

    // Sin campos vacios: el `ValidationPipe` corre con `forbidNonWhitelisted` y un
    // `undefined` explicito en el JSON no existe, pero mantenerlo limpio evita sorpresas.
    const payload = JSON.stringify(cuerpo, (_clave, valor) => valor ?? undefined);

    const respuesta = await fetch(`${API_BASE_URL}${RUTA_REPORTE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      // Deja que la peticion sobreviva a la navegacion o al cierre de la pestaña. Es lo
      // que hace que se reporte el error que ocurre justo antes de irse de la pagina.
      keepalive: true,
    });

    // Legible solo porque el backend lo publica con `exposedHeaders`; de otro modo el
    // navegador lo esconde en una peticion de otro origen. Ver `main.ts` del API.
    return respuesta.headers.get('x-request-id');
  } catch {
    // Si el API esta caido, este reporte tambien falla. No hay a quien contarselo, y la
    // telemetria jamas puede ser la causa de un fallo en la pagina.
    return null;
  }
}

let instalada = false;

/**
 * Engancha los dos huecos que un `ErrorBoundary` de React no cubre: lo que lanza fuera del
 * arbol (un handler, un `setTimeout`) y la promesa que nadie atrapo.
 *
 * Se llama una vez, desde `main.tsx`.
 */
export function instalarCapturaGlobal(): void {
  if (instalada) {
    return;
  }
  instalada = true;

  window.addEventListener('error', (evento) => {
    void reportarError({
      tipo: 'global',
      mensaje: evento.message || 'Error no controlado',
      traza: evento.error instanceof Error ? evento.error.stack : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (evento) => {
    const motivo: unknown = evento.reason;
    void reportarError({
      tipo: 'promesa',
      mensaje:
        motivo instanceof Error ? motivo.message : `Promesa rechazada: ${String(motivo)}`,
      traza: motivo instanceof Error ? motivo.stack : undefined,
    });
  });
}

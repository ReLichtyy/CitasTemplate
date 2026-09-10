import { reportarError } from '../lib/telemetria';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_STORAGE_KEY = 'auth_token';
const CABECERA_REQUEST_ID = 'x-request-id';

/**
 * `status` de un fallo que nunca llego a tener respuesta: API caida, DNS, CORS mal
 * puesto, o el visitante sin red. No es un codigo HTTP —no hubo—, y por eso es 0: deja
 * distinguir "el servidor dijo que no" de "el servidor no dijo nada", que son dos
 * problemas distintos y con dos arreglos distintos.
 */
export const SIN_RESPUESTA = 0;

/**
 * Error del API que conserva el texto que el servidor quiso mostrar y su codigo.
 *
 * Importa sobre todo en el 409: es el unico error redactado para que el usuario final
 * lo lea tal cual, y sin esto las paginas tendrian que inventarse una cadena.
 * Ver 04-contrato-api.md.
 */
export class ApiError extends Error {
  // Campo declarado aparte: `erasableSyntaxOnly` no admite propiedades de parametro.
  readonly status: number;

  /**
   * El `x-request-id` que devolvio el servidor. Es el mismo que quedo en su log, asi que
   * mostrarlo en pantalla convierte un "no me deja reservar" en algo que se busca con
   * `grep`. Nulo cuando la peticion no llego a contestar. Ver 10-observabilidad.md.
   */
  readonly requestId: string | null;

  constructor(message: string, status: number, requestId: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

type ManejadorNoAutorizado = () => void;

let manejadorNoAutorizado: ManejadorNoAutorizado | null = null;

/**
 * Un 401 sobre una peticion con token significa que la sesion murio (vencida, o firmada
 * con un secreto anterior). Se avisa una sola vez y desde aqui, para que ninguna pagina
 * tenga que acordarse de cerrar sesion por su cuenta. Ver 03-autorizacion.md.
 *
 * Devuelve la funcion para darse de baja.
 */
export function alPerderSesion(manejador: ManejadorNoAutorizado): () => void {
  manejadorNoAutorizado = manejador;
  return () => {
    if (manejadorNoAutorizado === manejador) {
      manejadorNoAutorizado = null;
    }
  };
}

type SobreRespuesta = { success: boolean; data: unknown; message: string | null };

function esSobre(cuerpo: unknown): cuerpo is SobreRespuesta {
  return typeof cuerpo === 'object' && cuerpo !== null && 'success' in cuerpo && 'data' in cuerpo;
}

async function leerCuerpo(response: Response): Promise<unknown> {
  // Un error puede venir sin cuerpo, o con uno que no es JSON.
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const MENSAJES_POR_DEFECTO: Record<number, string> = {
  401: 'Su sesion no es valida. Vuelva a iniciar sesion.',
  403: 'No tiene acceso a este recurso.',
  404: 'Recurso no encontrado.',
};

function mensajeDeError(cuerpo: unknown, response: Response): string {
  if (typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo) {
    const { message } = cuerpo as { message: unknown };
    // El ValidationPipe devuelve un arreglo; 04-contrato-api.md pide mostrar el primero.
    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return MENSAJES_POR_DEFECTO[response.status] ?? 'No se pudo completar la operacion.';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const metodo = options?.method ?? 'GET';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  } catch (fallo: unknown) {
    /**
     * `fetch` solo lanza cuando no hubo respuesta. Antes eso salia a la pantalla como
     * "Failed to fetch" —el texto del navegador, en ingles y sin sentido para quien lo
     * lee—; ahora es un `ApiError` con `status` 0 y un texto propio.
     *
     * Se reporta: es la unica falla que el servidor **no puede** registrar por su cuenta,
     * porque no se entero de que existio.
     */
    void reportarError({
      tipo: 'red',
      mensaje: `Sin respuesta del API: ${metodo} ${path}`,
      traza: fallo instanceof Error ? fallo.stack : undefined,
    });
    throw new ApiError(
      'No se pudo contactar el servidor. Revise su conexion e intente de nuevo.',
      SIN_RESPUESTA,
    );
  }

  const requestId = response.headers.get(CABECERA_REQUEST_ID);

  if (response.status === 204) {
    return undefined as T;
  }

  const cuerpo = await leerCuerpo(response);

  if (!response.ok) {
    // Solo si la peticion llevaba token: el 401 del login es "credenciales incorrectas",
    // no una sesion caida, y ahi no hay nada que cerrar.
    if (response.status === 401 && token) {
      manejadorNoAutorizado?.();
    }

    const mensaje = mensajeDeError(cuerpo, response);

    /**
     * Solo el 5xx se reporta. Un 4xx ya quedo en el log del servidor con este mismo
     * `requestId` (ver `ExcepcionesFilter`), y mandarlo otra vez seria contar dos veces lo
     * mismo — ademas de convertir cada validacion de formulario en una peticion extra.
     */
    if (response.status >= 500) {
      void reportarError({
        tipo: 'api',
        mensaje: `${response.status} en ${metodo} ${path}`,
        requestId: requestId ?? undefined,
      });
    }

    throw new ApiError(mensaje, response.status, requestId);
  }

  // El API envuelve toda respuesta en `{ success, data, message }` (`SobreInterceptor`,
  // global desde main.ts). Se desenvuelve aqui y las paginas ven solo `data`. El caso sin
  // sobre queda por si alguna respuesta se sirve fuera del interceptor. Ver 04-contrato-api.md.
  return (esSobre(cuerpo) ? cuerpo.data : cuerpo) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  /**
   * El cuerpo es opcional porque `DELETE /citas/:id` acepta uno (`motivo`) y casi ninguna
   * otra baja lo necesita. Se omite en vez de mandar `{}`: el `ValidationPipe` corre con
   * `forbidNonWhitelisted`, y un cuerpo vacio de mas no molesta hoy pero es ruido que
   * cualquier DTO futuro tendria que tolerar.
   */
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
};

const EXPIRA_STORAGE_KEY = 'auth_expira';

/**
 * El token y su caducidad, en `localStorage`.
 *
 * La caducidad se guarda al lado en vez de leerse del propio JWT: decodificarlo en el
 * navegador invita a confiar en su contenido, y lo que va dentro del token es asunto del
 * servidor. Aqui es un dato suelto para saber **cuando dejar de intentar**, nada mas — la
 * autoridad es la firma que el API verifica en cada peticion.
 *
 * Todo lo de la sesion se escribe y se borra junto: media sesion —token sin caducidad, o
 * al reves— es el estado del que salen los errores raros.
 */
export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_STORAGE_KEY),
  set: (token: string, expiraEn: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(EXPIRA_STORAGE_KEY, expiraEn);
  },
  /** ISO 8601, o `null` si no hay sesion guardada. */
  expiraEn: () => localStorage.getItem(EXPIRA_STORAGE_KEY),
  clear: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(EXPIRA_STORAGE_KEY);
  },
};

/**
 * La clave del token, para que `AuthContext` pueda reconocer el evento `storage` que
 * dispara otra pestana al entrar o salir. Se exporta la clave y no el valor: quien la lee
 * sigue pasando por `tokenStorage`.
 */
export const CLAVE_TOKEN = TOKEN_STORAGE_KEY;

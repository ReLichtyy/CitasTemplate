import { readFile } from 'node:fs/promises';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { TipoNotificacion } from '../../generated/prisma/client.js';
import {
  adjuntoDe,
  renderizar,
  type Adjunto,
} from '../../notificaciones/plantillas.js';
import {
  CanalNoDisponibleError,
  EnvioPermanenteError,
  WhatsappGateway,
  type ResultadoEnvio,
} from '../../notificaciones/whatsapp.gateway.js';
import { aChatId, idDeMensaje, type RespuestaEnvioWaha } from './waha.types.js';

/** Lo unico que significa "la sesion puede mandar mensajes". */
const SESION_OPERATIVA = 'WORKING';

/**
 * Cuanto vale la comprobacion de estado antes de repetirla. El worker drena en lotes
 * de 20: sin cache, cada pasada son 20 comprobaciones identicas contra WAHA. Corto a
 * proposito, porque el precio de un dato viejo es un intento gastado.
 */
const CACHE_ESTADO_MS = 15_000;

/**
 * Adaptador de WAHA sobre el puerto `WhatsappGateway`. Es la unica clase del backend
 * que sabe que del otro lado hay WhatsApp Web manejado por ingenieria inversa.
 *
 * El dia que el numero caiga y haya que migrar a la Cloud API de Meta, aparece un
 * `integrations/meta/` al lado de este archivo y no se toca ni el outbox, ni el
 * worker, ni el dominio de citas. Ver 09-conexion-whatsapp.md.
 */
@Injectable()
export class WahaClient extends WhatsappGateway {
  private readonly logger = new Logger(WahaClient.name);
  private estadoVerificadoEn = 0;
  /**
   * El adjunto en base64, cacheado por ruta. Es un archivo del propio despliegue que no
   * cambia mientras el proceso viva: releerlo y recodificarlo en cada aviso es trabajo
   * repetido dentro del camino que se acaba de optimizar.
   */
  private readonly adjuntosEnBase64 = new Map<string, string>();

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async enviar(
    destino: string,
    plantilla: TipoNotificacion,
    variables: Record<string, unknown>,
  ): Promise<ResultadoEnvio> {
    const { url, apiKey, sesion } = this.credenciales();

    // El destino se valida aqui aunque el outbox ya lo dejara en E.164: esta clase es
    // la frontera con el exterior, y una fila vieja o tocada a mano no puede salir en
    // una peticion con una forma que WAHA no entiende.
    if (!/^\+[1-9]\d{7,14}$/.test(destino)) {
      throw new EnvioPermanenteError(
        `Destino sin forma internacional valida: ${destino}`,
      );
    }

    await this.exigirSesionOperativa(url, apiKey, sesion);

    const texto = renderizar(plantilla, variables);
    const adjunto = adjuntoDe(plantilla);
    const soloTexto = { session: sesion, chatId: aChatId(destino), text: texto };

    let respuesta;
    try {
      // El cuerpo con imagen se arma aqui y no antes del try: si `enBase64` no puede
      // leer el asset, el fallo cae por el mismo camino que un rechazo del canal y el
      // aviso sale igual como texto. La imagen es del despliegue; el aviso, del negocio.
      const cuerpo = adjunto
        ? {
            session: sesion,
            chatId: aChatId(destino),
            // WhatsApp llama "caption" al texto que acompaña a una imagen. Va en la
            // **misma** peticion: mandar imagen y texto por separado son dos mensajes en
            // el chat, dos latencias y dos filas que conciliar.
            caption: texto,
            file: {
              mimetype: adjunto.mimetype,
              filename: adjunto.nombre,
              data: await this.enBase64(adjunto),
            },
          }
        : soloTexto;

      respuesta = await this.publicar<RespuestaEnvioWaha>(
        url,
        apiKey,
        adjunto ? 'sendImage' : 'sendText',
        cuerpo,
      );
    } catch (error) {
      // Sin adjunto no hay a donde caer: el rechazo es del mensaje o del canal, y
      // `traducir` ya sabe distinguirlos.
      if (!adjunto) {
        throw this.traducir(error);
      }

      /**
       * La imagen es cortesia; el aviso es el texto con el enlace de confirmacion.
       * NOWEB tiene fallos conocidos de subida de medios, y un mensaje que muere
       * porque fallo la decoracion es exactamente el aviso que este modulo tiene que
       * entregar si o si: se reenvia solo texto, que es la unica parte que el
       * cliente necesita para confirmar la cita.
       */
      this.logger.warn(
        `Fallo el envio con imagen (${this.detalle(error)}); se reenvia solo texto.`,
      );
      try {
        respuesta = await this.publicar<RespuestaEnvioWaha>(
          url,
          apiKey,
          'sendText',
          soloTexto,
        );
      } catch (errorTexto) {
        throw this.traducir(errorTexto);
      }
    }

    /**
     * Un envio aceptado prueba que la sesion esta viva mejor que cualquier consulta, y
     * revalida la ventana. Sin esto la cache no servia de nada en el caso real —avisos
     * espaciados minutos—: siempre estaba vencida y cada mensaje pagaba una consulta
     * extra de ~200 ms antes de salir.
     */
    this.estadoVerificadoEn = Date.now();

    // `key` es donde lo deja NOWEB; `id`, donde lo dejaba WEBJS. Ver waha.types.ts.
    const idExterno = idDeMensaje(respuesta.data?.id ?? respuesta.data?.key);
    if (!idExterno) {
      // No es un fallo de envio: el mensaje salio. Pero sin id no hay con que conciliar
      // el acuse de entrega despues, y eso conviene verlo en el log.
      this.logger.warn('WAHA acepto el mensaje sin devolver id.');
    }
    return { idExterno };
  }

  /**
   * Texto de conversacion (chatbot): sin plantilla y sin adjunto, pero con el mismo
   * contrato que `enviar` — misma validacion de destino, misma comprobacion de
   * sesion, misma traduccion de errores — porque es el mismo canal y los fallos
   * significan lo mismo. Ver 11-chatbot-reservas.md.
   */
  async enviarTexto(destino: string, texto: string): Promise<ResultadoEnvio> {
    const { url, apiKey, sesion } = this.credenciales();

    if (!/^\+[1-9]\d{7,14}$/.test(destino)) {
      throw new EnvioPermanenteError(
        `Destino sin forma internacional valida: ${destino}`,
      );
    }

    await this.exigirSesionOperativa(url, apiKey, sesion);

    let respuesta: { data: RespuestaEnvioWaha };
    try {
      respuesta = await this.publicar<RespuestaEnvioWaha>(url, apiKey, 'sendText', {
        session: sesion,
        chatId: aChatId(destino),
        text: texto,
      });
    } catch (error) {
      throw this.traducir(error);
    }

    // Un envio aceptado revalida la sesion, igual que en `enviar`.
    this.estadoVerificadoEn = Date.now();

    const idExterno = idDeMensaje(respuesta.data?.id ?? respuesta.data?.key);
    if (!idExterno) {
      this.logger.warn('WAHA acepto el mensaje sin devolver id.');
    }
    return { idExterno };
  }

  /**
   * Lee el adjunto una vez y lo deja cacheado en base64.
   *
   * Un fallo aqui es del despliegue —el asset no llego a `dist/`—, no del mensaje ni
   * del canal, y es `CanalNoDisponibleError` a proposito: no se gasta el presupuesto de
   * reintentos de los avisos por un archivo que falta, y en cuanto se corrige el
   * despliegue la cola sale sola.
   */
  private async enBase64(adjunto: Adjunto): Promise<string> {
    const clave = adjunto.ruta.href;
    const cacheado = this.adjuntosEnBase64.get(clave);
    if (cacheado) {
      return cacheado;
    }

    try {
      const datos = (await readFile(adjunto.ruta)).toString('base64');
      this.adjuntosEnBase64.set(clave, datos);
      return datos;
    } catch (error) {
      throw new CanalNoDisponibleError(
        `No se pudo leer el adjunto ${adjunto.nombre} (${clave}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * POST al canal. Autenticacion y timeout en un solo sitio: lo que la peticion de
   * envio y su reintento sin imagen comparten, y lo que no puede divergir entre ellas.
   */
  private publicar<T>(
    url: string,
    apiKey: string,
    ruta: string,
    cuerpo: unknown,
  ): Promise<{ data: T }> {
    return firstValueFrom(
      this.http.post<T>(`${url}/api/${ruta}`, cuerpo, {
        headers: { 'X-Api-Key': apiKey },
        timeout: this.config.get<number>('waha.timeoutMs'),
      }),
    );
  }

  /** Para el log del personal; no sale al cliente. */
  private detalle(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Configuracion completa o no se manda nada.
   *
   * Se lanza `CanalNoDisponibleError` y no un `Error` cualquiera: que falte la clave es
   * un problema del despliegue, no del mensaje, y gastarle los cuatro intentos a una
   * cola entera mientras alguien arregla el `.env` es perder avisos por una errata.
   */
  private credenciales(): { url: string; apiKey: string; sesion: string } {
    const url = this.config.get<string>('waha.url');
    const apiKey = this.config.get<string>('waha.apiKey');
    const sesion = this.config.get<string>('waha.session');
    if (!url || !apiKey || !sesion) {
      throw new CanalNoDisponibleError(
        'WAHA no esta configurado (WAHA_URL / WAHA_API_KEY / WAHA_SESSION).',
      );
    }
    return { url, apiKey, sesion };
  }

  /**
   * Preguntar por la sesion antes de mandar.
   *
   * Sin esto, con la sesion caida cada aviso se va por el camino del fallo generico:
   * cuatro intentos, hora y cuarto de espera acumulada y FALLIDA definitiva, cuando lo
   * unico que pasaba es que habia que volver a escanear el QR. Preguntar cuesta una
   * peticion local cacheada; equivocarse cuesta la cola entera.
   */
  private async exigirSesionOperativa(
    url: string,
    apiKey: string,
    sesion: string,
  ): Promise<void> {
    if (Date.now() - this.estadoVerificadoEn < CACHE_ESTADO_MS) {
      return;
    }

    let estado: string | undefined;
    try {
      const { data } = await firstValueFrom(
        this.http.get<{ status?: string }>(
          `${url}/api/sessions/${encodeURIComponent(sesion)}`,
          {
            headers: { 'X-Api-Key': apiKey },
            timeout: this.config.get<number>('waha.timeoutMs'),
          },
        ),
      );
      estado = data?.status;
    } catch (error) {
      /**
       * Una sesion que no existe es un problema del despliegue —el nombre no
       * coincide—, no de este mensaje. Clasificarla como rechazo permanente mataba la
       * fila al instante y el aviso no salia ni despues de que alguien corrigiera la
       * variable, porque FALLIDA no se reintenta. Como canal caido reintenta cada
       * 5 min hasta 24 h, que es la ventana que tiene el despliegue para corregirse.
       */
      if (
        error instanceof AxiosError &&
        (error.response?.status === 404 || error.response?.status === 422)
      ) {
        throw new CanalNoDisponibleError(
          `La sesion ${sesion} no existe en WAHA. Revisar WAHA_SESSION.`,
        );
      }
      throw this.traducir(error);
    }

    if (estado !== SESION_OPERATIVA) {
      throw new CanalNoDisponibleError(
        `La sesion de WhatsApp esta en ${estado ?? 'desconocido'} y no en ${SESION_OPERATIVA}.`,
      );
    }
    this.estadoVerificadoEn = Date.now();
  }

  /**
   * Traduce el fallo del canal al vocabulario del puerto. Es el corazon de la decision
   * de reintentar: sin esto el worker trata igual "este numero no tiene WhatsApp" que
   * "WAHA esta reiniciandose", y uno de los dos siempre sale mal.
   *
   * Un 4xx habla del mensaje; un 5xx, una desconexion o un timeout hablan del canal.
   * Las excepciones son deliberadas: 401 y 403 son la clave mal puesta y 429 es
   * saturacion, y ninguno de los tres mejora por dejar morir el aviso.
   */
  private traducir(error: unknown): Error {
    if (!(error instanceof AxiosError)) {
      return error instanceof Error ? error : new Error(String(error));
    }

    const estado = error.response?.status;
    const detalle = `${estado ?? error.code ?? 'sin estado'}: ${error.message}`;

    if (estado === 401 || estado === 403) {
      return new CanalNoDisponibleError(
        `WAHA rechazo la autenticacion (${detalle}). Revisar que WAHA_API_KEY del API corresponda al hash de WAHA_API_KEY_HASH del contenedor.`,
      );
    }
    if (estado === 429) {
      return new CanalNoDisponibleError(`WAHA esta saturado (${detalle}).`);
    }
    if (estado !== undefined && estado >= 400 && estado < 500) {
      return new EnvioPermanenteError(`WAHA rechazo el mensaje (${detalle}).`);
    }
    return new CanalNoDisponibleError(`WAHA no respondio (${detalle}).`);
  }
}

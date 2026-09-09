import type { TipoNotificacion } from '../generated/prisma/client.js';

/**
 * El puerto de salida. Aqui vive la interfaz y nada mas: la implementacion esta en
 * `integrations/`, y por eso el worker y el dominio de citas no nombran a WAHA jamas.
 *
 * No es arquitectura por gusto. WAHA maneja una sesion de WhatsApp Web por ingenieria
 * inversa y el riesgo de baneo cae sobre el numero del negocio; el dia que haya que
 * migrar a la Cloud API de Meta se escribe un segundo adaptador y no se toca ni el
 * outbox, ni el worker, ni las citas. Si esa migracion resulta cara, esta frontera se
 * rompio en algun punto. Ver 09-conexion-whatsapp.md.
 */
export interface ResultadoEnvio {
  /**
   * Id del mensaje del lado del canal. Se guarda en `NotificacionSalida.idExterno`
   * y es lo unico que permite conciliar despues un acuse de entrega con la fila que
   * lo origino. Un canal que no lo devuelva deja la conciliacion sin base.
   */
  idExterno?: string;
}

/**
 * El canal rechazo **este** mensaje y volver a mandarlo daria el mismo resultado: un
 * numero sin WhatsApp, un destino con forma invalida.
 *
 * Existe porque sin esta distincion el worker reintenta cuatro veces contra un numero
 * que nunca va a recibir nada —una hora y cuarto de cola ocupada— y llega a FALLIDA
 * por agotamiento, que es el mismo estado final pero mucho mas tarde y con el error
 * util enterrado bajo tres reintentos identicos.
 */
export class EnvioPermanenteError extends Error {}

/**
 * El canal entero no esta disponible: la sesion se cayo, WAHA no responde, la clave
 * no sirve. No dice nada del mensaje.
 *
 * Se distingue porque **no debe consumir intentos**: si la sesion de WhatsApp esta
 * caida veinte minutos, los cuatro intentos se agotan solos y avisos perfectamente
 * validos mueren en FALLIDA por un problema que no era de ellos y que ya se resolvio.
 */
export class CanalNoDisponibleError extends Error {}

/**
 * Clase abstracta y no `interface` a proposito: Nest necesita un token de inyeccion
 * que exista en tiempo de ejecucion.
 *
 * `plantilla` es el tipo de aviso, no un texto ya armado. Un canal con plantillas
 * propias (Meta las aprueba una por una) mapea el tipo a la suya; uno de texto libre
 * lo renderiza. El outbox no sabe cual de los dos hay del otro lado.
 */
export abstract class WhatsappGateway {
  abstract enviar(
    destino: string,
    plantilla: TipoNotificacion,
    variables: Record<string, unknown>,
  ): Promise<ResultadoEnvio>;
}

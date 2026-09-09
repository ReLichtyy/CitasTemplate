import { registerAs } from '@nestjs/config';

/**
 * `NOTIFICACIONES_WORKER` es lo que decide si el cron de este proceso drena el
 * outbox. Es la misma imagen del API desplegada dos veces con distinta
 * configuracion: duplicar el codigo para tener un worker es pagar dos veces por el
 * mismo dominio. Ver 09-conexion-whatsapp.md.
 *
 * `urlPublica` es el origen del **frontend**, no el del API: el enlace de
 * confirmacion apunta a una pagina, porque un GET no puede confirmar nada (WhatsApp
 * previsualiza los enlaces y los navegadores hacen prefetch).
 */
export default registerAs('notificaciones', () => ({
  worker: process.env.NOTIFICACIONES_WORKER === 'true',
  urlPublica: (
    process.env.FRONTEND_URL ??
    process.env.CORS_ORIGIN ??
    'http://localhost:5173'
  ).replace(/\/+$/, ''),
  /** Filas reclamadas por pasada. Coincide con el LIMIT del SELECT ... SKIP LOCKED. */
  lote: Number(process.env.NOTIFICACIONES_LOTE ?? 20),
  /**
   * Cada cuanto el worker mira el outbox, en milisegundos.
   *
   * **No es el camino normal del aviso.** Cuando el API y el worker son el mismo
   * proceso, la reserva despierta al worker en cuanto la transaccion confirma y el
   * mensaje sale sin esperar a ningun tic; el sondeo solo cubre lo que ese aviso no
   * puede: los reintentos programados, las filas que otro proceso dejo a medias, y el
   * despliegue con worker separado —el del VPS—, donde quien reserva no tiene forma de
   * avisarle a un proceso que no es el suyo.
   *
   * Ahi es donde este numero **es** la latencia. A 20 segundos, una reserva hecha
   * contra el API en el VPS espera de 0 a 20 segundos a que el worker la vea.
   *
   * Era un `@Cron` de un minuto y esa era practicamente toda la latencia medida: el
   * envio tardaba 0.6 s y la espera al tic entre 13 y 46 s.
   */
  intervaloMs: Number(process.env.NOTIFICACIONES_INTERVALO_MS ?? 20000),
  /**
   * Reintentos antes de FALLIDA. Un mensaje reintentado para siempre contra un numero
   * invalido es un worker que nunca avanza.
   */
  maxIntentos: Number(process.env.NOTIFICACIONES_MAX_INTENTOS ?? 4),
}));

/** Retroceso exponencial, en minutos, indexado por numero de intento fallido. */
export const ESPERA_MINUTOS = [1, 5, 15, 60];

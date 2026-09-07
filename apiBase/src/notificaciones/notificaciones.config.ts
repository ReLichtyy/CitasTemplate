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
   * Reintentos antes de FALLIDA. Un mensaje reintentado para siempre contra un numero
   * invalido es un worker que nunca avanza.
   */
  maxIntentos: Number(process.env.NOTIFICACIONES_MAX_INTENTOS ?? 4),
}));

/** Retroceso exponencial, en minutos, indexado por numero de intento fallido. */
export const ESPERA_MINUTOS = [1, 5, 15, 60];

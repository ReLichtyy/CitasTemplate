import { registerAs } from '@nestjs/config';

/**
 * `CHATBOT_ENABLED` es el interruptor del flujo de reserva por WhatsApp. Apagado
 * (default), el webhook descarta los `message` como siempre y nada de este modulo
 * existe para afuera. Es el mismo trato que `WAHA_URL` al gateway: encenderlo es
 * una decision del despliegue, no del codigo.
 *
 * La expiracion es de inactividad: cada mensaje del cliente la renueva, y una
 * conversacion vencida se borra con el mensaje siguiente, sin cron. Media hora
 * alcanza para elegir sin apuro y no deja filas de la semana pasada esperando
 * un "1".
 */
export default registerAs('chatbot', () => ({
  enabled: process.env.CHATBOT_ENABLED === 'true',
  expiracionMs: Number(process.env.CHATBOT_EXPIRACION_MIN ?? 30) * 60_000,
}));

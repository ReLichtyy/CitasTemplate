import { registerAs } from '@nestjs/config';

/**
 * Configuracion propia del adaptador, en su namespace, igual que
 * `external-api.config.ts`. Nada de esto se lee fuera de `integrations/waha/`: si el
 * nombre "waha" aparece en el outbox, el worker o el dominio de citas, la frontera
 * del gateway ya se rompio. Ver 09-conexion-whatsapp.md.
 *
 * `url` vacia significa "no hay canal": el modulo cae en el gateway de log y el
 * outbox sigue funcionando. Es lo que permite verificar reintentos e idempotencia
 * sin gastar una sesion de WhatsApp.
 *
 * En local `WAHA_URL=http://localhost:3001` (WAHA escucha en 3000 adentro del
 * contenedor y se publica corrido para no chocar con el API). En el VPS,
 * `http://waha:3000` por la red interna de Docker: ese puerto no se publica jamas,
 * porque quien lo alcance manda WhatsApp con el numero del negocio.
 */
export default registerAs('waha', () => {
  const url = (process.env.WAHA_URL ?? '').replace(/\/+$/, '');

  /**
   * Con canal configurado, la configuracion tiene que estar completa. Faltando la
   * clave o la sesion el arranque seguia y el sintoma aparecia mucho despues, en filas
   * del outbox que fallaban una por una contra un 401 o un 422 que nadie miraba.
   * Es preferible que no arranque.
   */
  if (url) {
    const faltan = [
      ['WAHA_API_KEY', process.env.WAHA_API_KEY],
      ['WAHA_SESSION', process.env.WAHA_SESSION],
      ['WAHA_HOOK_HMAC_KEY', process.env.WAHA_HOOK_HMAC_KEY],
    ]
      .filter(([, valor]) => !valor)
      .map(([nombre]) => nombre);

    if (faltan.length > 0) {
      throw new Error(
        `WAHA_URL esta puesta pero faltan: ${faltan.join(', ')}. Ver apiBase/.env.example.`,
      );
    }
  }

  return {
    url,
    /** Viaja en la cabecera `X-Api-Key`. Es la unica autenticacion que tiene WAHA. */
    apiKey: process.env.WAHA_API_KEY ?? '',
    /** El tier CORE admite una sola sesion. */
    session: process.env.WAHA_SESSION ?? 'default',
    timeoutMs: Number(process.env.WAHA_TIMEOUT_MS ?? 15000),
    /** Con el que WAHA firma los webhooks. Sin ella, el webhook se rechaza entero. */
    hookHmacKey: process.env.WAHA_HOOK_HMAC_KEY ?? '',
  };
});

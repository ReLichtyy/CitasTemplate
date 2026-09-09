/**
 * Vocabulario de WhatsApp/WAHA. Vive aqui y no sale de esta carpeta: `@c.us` o
 * `ack` en el outbox serian la frontera del gateway rompiendose.
 */

/**
 * Respuesta de `POST /api/sendText`.
 *
 * El id del mensaje viaja en un sitio distinto segun el motor: WEBJS lo pone en `id`
 * —plano o envuelto—, y NOWEB lo devuelve dentro de `key`. Se declaran los dos porque
 * el id es lo unico con lo que despues se concilia un acuse de entrega, y perderlo no
 * rompe el envio: rompe el acuse, mucho mas tarde y sin sintoma claro.
 */
export interface RespuestaEnvioWaha {
  /** WEBJS. Con la forma `true_<chatId>_<serial>`. */
  id?: string | { id?: string; _serialized?: string };
  /** NOWEB. El id util es `key.id`. */
  key?: { id?: string; _serialized?: string };
  [clave: string]: unknown;
}

/** Estados de entrega de WhatsApp. El numero es lo que manda WAHA. */
export enum AckWhatsapp {
  ERROR = -1,
  PENDIENTE = 0,
  ENVIADO_AL_SERVIDOR = 1,
  ENTREGADO = 2,
  LEIDO = 3,
  REPRODUCIDO = 4,
}

/** Envoltura comun de todo evento del webhook de WAHA. */
export interface EventoWaha {
  id?: string;
  event?: string;
  session?: string;
  payload?: {
    id?: string | { _serialized?: string };
    /** NOWEB: el id del mensaje acusado viene aqui, no en `id`. */
    key?: { id?: string; _serialized?: string };
    from?: string;
    body?: string;
    fromMe?: boolean;
    ack?: number;
    [clave: string]: unknown;
  };
  [clave: string]: unknown;
}

/**
 * `chatId` de WhatsApp: el numero internacional **sin `+`** con `@c.us` pegado
 * atras. La traduccion de telefono a `chatId` vive solo aqui.
 */
export function aChatId(telefonoE164: string): string {
  return `${telefonoE164.replace(/\D/g, '')}@c.us`;
}

/**
 * Id del mensaje, en una sola forma.
 *
 * Hay que normalizar porque las dos puntas no coinciden: `sendText` devuelve el id
 * pelado —`3EB0A6B34F0E4AB5B81A46`— y el acuse lo reporta serializado
 * —`true_50660255433@c.us_3EB0A6B34F0E4AB5B81A46`—. Guardar uno y comparar contra el
 * otro deja `entregadaEn` en NULL para siempre, y el sintoma no aparece en el envio
 * sino mucho despues, en un acuse que nunca concilia.
 *
 * Se conserva el serial, que es la parte estable: en un grupo la forma serializada
 * agrega el participante al final, asi que el ultimo segmento no sirve.
 */
export function idDeMensaje(valor: unknown): string | undefined {
  const bruto = extraer(valor);
  if (bruto === undefined) {
    return undefined;
  }

  // `true_<chatId>_<serial>` o `false_<chatId>_<serial>`; en grupo, un segmento mas.
  const partes = bruto.split('_');
  if (partes.length >= 3 && (partes[0] === 'true' || partes[0] === 'false')) {
    return partes[2];
  }
  return bruto;
}

/** El id llega a veces plano, a veces envuelto en `id` y a veces en `key`. */
function extraer(valor: unknown): string | undefined {
  if (typeof valor === 'string') {
    return valor;
  }
  if (typeof valor === 'object' && valor !== null) {
    const objeto = valor as { id?: unknown; _serialized?: unknown };
    if (typeof objeto._serialized === 'string') {
      return objeto._serialized;
    }
    if (typeof objeto.id === 'string') {
      return objeto.id;
    }
  }
  return undefined;
}

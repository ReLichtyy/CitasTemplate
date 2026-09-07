/**
 * Vocabulario de WhatsApp/WAHA. Vive aqui y no sale de esta carpeta: `@c.us` o
 * `ack` en el outbox serian la frontera del gateway rompiendose.
 */

/** Respuesta de `POST /api/sendText`. */
export interface RespuestaEnvioWaha {
  /** Id del mensaje, con la forma `true_<chatId>_<serial>`. */
  id?: string | { id?: string; _serialized?: string };
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

/** El id del mensaje llega a veces plano y a veces envuelto. */
export function idDeMensaje(valor: unknown): string | undefined {
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

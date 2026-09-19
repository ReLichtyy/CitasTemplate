import type { MensajeDeChat } from './flujo-reserva.js';

/**
 * El puerto del cerebro conversacional. El chatbot habla con esta interfaz y no
 * sabe si del otro lado hay Mistral, OpenAI o un modelo local: el dia que cambie
 * de proveedor aparece otro adaptador en `integrations/` y este modulo no se toca.
 * Es la misma frontera que `WhatsappGateway` con WAHA.
 *
 * La composicion la hace `chatbot.module.ts` segun `LLM_API_KEY`: sin clave no hay
 * asistente y el modulo cae al modo de menus numerados, que no necesita ninguno.
 */
export abstract class AsistenteChat {
  /**
   * Un turno. `instrucciones` es el prompt de sistema completo — objetivos, reglas
   * y contexto del negocio — y el `historial` son los ultimos turnos reales de la
   * conversacion. Devuelve la respuesta ya parseada como JSON del contrato de
   * `instrucciones.ts`, o lanza si el proveedor no respondio algo utilizable.
   */
  abstract conversar(
    instrucciones: string,
    historial: MensajeDeChat[],
  ): Promise<RespuestaAsistente>;
}

/**
 * El asistente entero no esta disponible: falta la clave, no responde, la rechazo,
 * o devolvio algo que no es el JSON del contrato. No dice nada del mensaje: el
 * proximo turno del cliente reintenta solo, como en el canal.
 */
export class AsistenteNoDisponibleError extends Error {}

/**
 * La implementacion sin cerebro: falla en el primer turno. Se compone cuando falta
 * la clave, y su unica razon de existir es que el grafo de Nest resuelva: al
 * modulo caer al modo de menus, nadie deberia llamarla nunca. Si se la llama, el
 * error es del nombre correcto y no de un `undefined` en cualquier lado.
 */
export class AsistenteNoConfigurado extends AsistenteChat {
  async conversar(): Promise<never> {
    throw new AsistenteNoDisponibleError('No hay LLM configurado (LLM_API_KEY).');
  }
}

/** El JSON que el contrato de instrucciones exige como unica salida del modelo. */
export interface RespuestaAsistente {
  /** El texto para el cliente, tal cual se envia por WhatsApp. */
  respuesta: string;
  /** `nada` (seguir conversando), `cancelar` o `reservar`. */
  accion: string;
  /** Lo que el cliente definio en este turno. Se valida contra la base siempre. */
  datos?: {
    servicioId?: string;
    empleadoId?: string;
    inicio?: string;
    nombre?: string;
  };
}

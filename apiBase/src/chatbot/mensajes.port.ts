/**
 * Puerto de entrada del chatbot. Lo llama el webhook de WhatsApp —su unico cliente—
 * y nada mas: ni rutas HTTP propias, ni cron. La implementacion se compone en
 * `chatbot.module.ts` segun `CHATBOT_ENABLED`. Ver 11-chatbot-reservas.md.
 */

/**
 * Un mensaje entrante, ya traducido por la frontera del canal. Aqui no existe
 * `chatId`, `@c.us` ni `fromMe`: eso lo resuelve `integrations/waha/` antes de
 * llamar al puerto, y lo que queda es una persona con un telefono y un texto.
 */
export interface MensajeEntrante {
  /**
   * Telefono en forma local (8 digitos): la identidad del cliente —la misma de
   * `Usuario`— y la clave de su conversacion. El bot no lo pregunta: quien
   * escribio, es.
   */
  telefono: string;
  /** E.164 con `+`: adonde se contesta. Lo trae el canal, nadie lo construye. */
  destino: string;
  /** El texto tal como llego. Sin texto (sticker, audio) la frontera no llama. */
  texto: string;
}

export abstract class ProcesadorMensajes {
  abstract procesar(mensaje: MensajeEntrante): Promise<void>;
}

/**
 * La implementacion apagada: no hace nada. Con `CHATBOT_ENABLED=false` el webhook
 * sigue descartando los `message` exactamente como antes del chatbot — atar el
 * puerto a esta clase es lo que mantiene el camino de avisos intocado hasta que
 * el despliegue decida encenderlo.
 */
export class ProcesadorNulo extends ProcesadorMensajes {
  async procesar(): Promise<void> {}
}

import { registerAs } from '@nestjs/config';

/**
 * Config del asistente LLM. Sin `LLM_API_KEY` no hay cliente: `chatbot.module.ts`
 * compone el modo de menus numerados en su lugar, igual que `WAHA_URL` vacio cae al
 * gateway de log — el despliegue decide si hay cerebro conversacional, no el codigo.
 *
 * El modelo por defecto es el chico de Mistral: conversacion corta de WhatsApp,
 * contexto acotado, y costo por mensaje que no se justifica subir "por si acaso".
 */
export default registerAs('mistral', () => ({
  url: (process.env.LLM_URL ?? 'https://api.mistral.ai/v1').replace(/\/+$/, ''),
  apiKey: process.env.LLM_API_KEY ?? '',
  model: process.env.LLM_MODEL ?? 'mistral-small-latest',
  timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 30000),
}));

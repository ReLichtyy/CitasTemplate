import { AsyncLocalStorage } from 'node:async_hooks';

export interface ContextoPeticion {
  /** Identificador de la peticion. Aparece en todo log que salga mientras se atiende. */
  requestId: string;
}

/**
 * El id de peticion tiene que llegar hasta el logger, y el logger lo llama cualquiera:
 * un servicio, un guard, el filtro de excepciones. Pasarlo por parametro obligaria a que
 * cada firma del backend cargue con un argumento que no es suyo.
 *
 * `AsyncLocalStorage` es la alternativa: el middleware abre el contexto al entrar la
 * peticion y todo lo que ocurra dentro de esa cadena async lo ve, sin tocar ninguna firma.
 * Es API estable de Node desde la 16.
 *
 * Fuera de una peticion —arranque, cron del worker— no hay contexto y `requestIdActual()`
 * devuelve `null`. Eso es correcto y no un fallo: esos logs no pertenecen a nadie.
 */
export const almacenPeticion = new AsyncLocalStorage<ContextoPeticion>();

export function requestIdActual(): string | null {
  return almacenPeticion.getStore()?.requestId ?? null;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

export type AccionApi<Args extends unknown[], T> = {
  /** Lanza la accion. Devuelve el resultado, o `null` si fallo. Nunca lanza. */
  ejecutar: (...args: Args) => Promise<T | null>;
  enviando: boolean;
  /** Texto que devolvio el API. Nulo mientras no haya fallado. */
  error: string | null;
  /** Para borrar el error al reintentar sin esperar a que la peticion conteste. */
  limpiarError: () => void;
};

/**
 * La contraparte de `useRecursoApi` para las escrituras: cancelar, reprogramar, cambiar
 * de estado.
 *
 * Una lectura y una escritura no tienen la misma forma, y por eso no comparten hook. Una
 * lectura arranca sola al montar y su estado natural es "cargando"; una escritura arranca
 * cuando alguien pulsa, puede no ocurrir nunca, y necesita **no** dispararse dos veces
 * porque el usuario pulso dos veces. Eso ultimo es lo que justifica el hook: sin el, cada
 * pagina se escribe su propio `enviando` y en algun boton se olvida.
 *
 * Dos garantias:
 *
 * - **Una a la vez.** Mientras hay una en vuelo, las llamadas siguientes devuelven `null`
 *   sin tocar el API. Un doble clic en "Cancelar cita" manda una peticion, no dos.
 * - **No lanza.** Devuelve `null` en el fallo y deja el texto en `error`. Quien llama
 *   decide si navegar o quedarse; no hay `try/catch` repetido en cada pagina.
 *
 * A diferencia de la lectura, aqui **no** se descarta el resultado si el componente se
 * desmonto: la escritura ya ocurrio en el servidor y quien llama suele querer navegar
 * justo despues. Lo que si se evita es el `setState` sobre un componente desmontado.
 */
export function useAccionApi<Args extends unknown[], T>(
  accion: (...args: Args) => Promise<T>,
): AccionApi<Args, T> {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // En una ref y no en el estado: el guardia tiene que ver el valor nuevo en el mismo
  // tick del segundo clic, y un `setState` no se refleja hasta el proximo render.
  const enVuelo = useRef(false);

  // Una escritura puede contestar despues de que la pagina se fue (justo lo que pasa al
  // cancelar y navegar al listado). Se marca el desmontaje para no pintar un error sobre
  // un componente que ya no esta. Se vuelve a encender al montar porque StrictMode monta,
  // desmonta y vuelve a montar: sin esa linea quedaria apagada desde el primer ciclo.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const limpiarError = useCallback(() => setError(null), []);

  const ejecutar = useCallback(
    async (...args: Args): Promise<T | null> => {
      if (enVuelo.current) {
        return null;
      }
      enVuelo.current = true;
      setEnviando(true);
      setError(null);

      try {
        return await accion(...args);
      } catch (fallo: unknown) {
        // El texto sale del API cuando lo trae; nunca se inventa uno mas especifico.
        // Importa sobre todo en el 409 ("Ese horario ya esta tomado"), que es el unico
        // redactado para que el usuario final lo lea tal cual. Ver 04-contrato-api.md.
        if (montado.current) {
          setError(
            fallo instanceof ApiError || fallo instanceof Error
              ? fallo.message
              : 'No se pudo completar la operacion.',
          );
        }
        return null;
      } finally {
        enVuelo.current = false;
        if (montado.current) {
          setEnviando(false);
        }
      }
    },
    [accion],
  );

  return { ejecutar, enviando, error, limpiarError };
}

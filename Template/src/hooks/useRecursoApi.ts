import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';

export type RecursoApi<T> = {
  datos: T | null;
  cargando: boolean;
  /** Texto que devolvio el API. Nulo mientras no haya fallado. */
  error: string | null;
};

/**
 * Una lectura del API con sus tres estados. Existe porque el catalogo publico se pide
 * desde tres lugares (`EquipoPage` dos veces, `ServiciosPage` una) y repetir el
 * `useEffect` en cada uno es donde se cuelan los errores: la peticion que no se cancela al
 * desmontar, el `cargando` que se queda encendido cuando falla.
 *
 * No es una libreria de data-fetching ni pretende serlo: sin cache, sin reintento, sin
 * invalidacion. Cuando haga falta algo de eso, se cambia esto por react-query y las
 * paginas no se enteran.
 *
 * `cargar` se lee una sola vez por montaje: pasarle una funcion nueva en cada render no
 * dispara otra peticion. Si el recurso depende de un valor que cambia, esa dependencia se
 * declara en `deps`.
 */
export function useRecursoApi<T>(cargar: () => Promise<T>, deps: unknown[] = []): RecursoApi<T> {
  const [estado, setEstado] = useState<RecursoApi<T>>({
    datos: null,
    cargando: true,
    error: null,
  });

  // Las dependencias llegan por parametro, asi que la regla no puede verificarlas desde
  // aqui: quien llama es responsable de declarar lo que el `cargar` lee.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let vigente = true;
    setEstado({ datos: null, cargando: true, error: null });

    cargar()
      .then((datos) => {
        if (vigente) {
          setEstado({ datos, cargando: false, error: null });
        }
      })
      .catch((fallo: unknown) => {
        if (!vigente) {
          return;
        }
        // El texto sale del API cuando lo trae; nunca se inventa uno mas especifico.
        const error =
          fallo instanceof ApiError || fallo instanceof Error
            ? fallo.message
            : 'No se pudo cargar la informacion.';
        setEstado({ datos: null, cargando: false, error });
      });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return estado;
}

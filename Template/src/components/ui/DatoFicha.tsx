import type { ReactNode } from 'react';

/**
 * Una etiqueta y su valor dentro de una ficha.
 *
 * Va en `<dt>`/`<dd>`, asi que **quien lo use tiene que envolverlo en un `<dl>`**: un par
 * suelto fuera de una lista de definiciones no es HTML valido y un lector de pantalla deja
 * de asociar el valor con su etiqueta. Es la razon de que este componente no traiga su
 * propio contenedor: dos pares consecutivos comparten uno.
 */
export function DatoFicha({
  etiqueta,
  children,
  /** Ocupa el ancho completo de la rejilla: notas, direcciones, cualquier texto largo. */
  ancho = false,
}: {
  etiqueta: string;
  children: ReactNode;
  ancho?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${ancho ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs font-medium text-text-muted">{etiqueta}</dt>
      <dd className="m-0 text-sm text-text-h">{children}</dd>
    </div>
  );
}

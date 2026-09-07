import type { ReactNode } from 'react';

/**
 * Mensaje del API enmarcado para que no se lea como una linea mas del formulario.
 *
 * Un solo tono, con los tokens que existen: la paleta no tiene color de error e inventarlo
 * aqui seria decidir marca de paso (05-marca-y-responsive.md). `role="alert"` hace que el
 * lector de pantalla lo anuncie al aparecer.
 */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-accent-border bg-accent-bg px-4 py-3 text-sm font-medium text-text-h"
    >
      {children}
    </p>
  );
}

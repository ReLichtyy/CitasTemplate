import type { HTMLAttributes } from 'react';

export const CARD_BASE_CLASSES = 'rounded-xl border border-border bg-surface p-4 sm:p-6';

// Card que abre detalle: `group` habilita el icono que reacciona al hover/foco de la card
// entera (ver CardDetailIcon). Compartido por ServicioCard y EspecialistaCard.
export const CARD_INTERACTIVE_CLASSES = `${CARD_BASE_CLASSES} group w-full text-left transition-colors hover:border-accent-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border`;

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`${CARD_BASE_CLASSES} ${className}`} {...props} />;
}

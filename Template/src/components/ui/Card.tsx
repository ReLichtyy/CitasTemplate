import type { HTMLAttributes } from 'react';

export const CARD_SHELL_CLASSES = 'rounded-xl border border-border bg-surface';
const CARD_PADDING_CLASSES = 'p-4 sm:p-6';

export const CARD_BASE_CLASSES = `${CARD_SHELL_CLASSES} ${CARD_PADDING_CLASSES}`;

// Lo que hace que una card se sienta abrible: `group` habilita el icono que reacciona al
// hover/foco de la card entera (ver CardDetailIcon). Vive aparte del relleno porque hay dos
// formas de card que lo comparten y solo una lleva padding propio.
const CARD_INTERACTIVE_BEHAVIOR =
  'group w-full text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-lg hover:shadow-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border';

// Card de contenido: el relleno es de la card y los hijos no lo tocan.
export const CARD_INTERACTIVE_CLASSES = `${CARD_BASE_CLASSES} ${CARD_INTERACTIVE_BEHAVIOR}`;

// Card que empieza con una imagen a sangre: sin relleno propio —lo pone el bloque de texto—
// y recortando, para que la foto llegue al borde redondeado sin desbordarlo. No se resuelve
// con un `p-0` encima de `CARD_BASE_CLASSES`: dos utilidades de la misma especificidad se
// resuelven por el orden de la hoja generada, no por el orden en que se concatenan.
export const CARD_MEDIA_INTERACTIVE_CLASSES = `${CARD_SHELL_CLASSES} overflow-hidden ${CARD_INTERACTIVE_BEHAVIOR}`;

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`${CARD_BASE_CLASSES} ${className}`} {...props} />;
}

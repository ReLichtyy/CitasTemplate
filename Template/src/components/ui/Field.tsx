import type { InputHTMLAttributes, ReactNode } from 'react';

// El campo se apoya en `bg-surface` como las cards: sobre el plateado del fondo, un input
// del mismo color que la pagina no se lee como una caja donde escribir. El borde toma el
// acento en hover y en foco, que es la unica diferencia entre "hay algo aqui" y "estoy aqui".
export const CAMPO_CLASSES =
  'min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-h transition-[border-color,box-shadow] duration-150 placeholder:text-text-muted hover:border-accent-border focus-visible:border-accent-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Texto bajo el campo: por que se pide, o por que no se puede editar. */
  hint?: ReactNode;
  /** Clases del `label`, para el ancho de columna en una rejilla. */
  wrapperClassName?: string;
};

/**
 * Campo etiquetado. La etiqueta envuelve al input en vez de usar `htmlFor`: no hay id que
 * mantener unico y el area tactil de la etiqueta ya activa el campo.
 */
export function Field({ label, hint, wrapperClassName = '', className = '', ...props }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-text ${wrapperClassName}`}>
      {label}
      <input className={`${CAMPO_CLASSES} ${className}`} {...props} />
      {hint && <span className="text-xs text-text">{hint}</span>}
    </label>
  );
}

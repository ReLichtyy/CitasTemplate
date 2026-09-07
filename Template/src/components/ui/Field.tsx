import type { InputHTMLAttributes, ReactNode } from 'react';

export const CAMPO_CLASSES =
  'min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text-h transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border disabled:opacity-60';

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

import type { ReactNode } from 'react';

export type AlertVariant = 'error' | 'success';

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: 'border-danger-border bg-danger-bg text-danger',
  success: 'border-success-border bg-success-bg text-success',
};

const ICON_PATH: Record<AlertVariant, ReactNode> = {
  error: <path d="M12 7.5v6M12 16.5v.5M12 3l9 16H3z" />,
  success: <path d="m5 12.5 4.5 4.5L19 7" />,
};

/**
 * Mensaje del API enmarcado para que no se lea como una linea mas del formulario.
 *
 * `role="alert"` hace que el lector de pantalla lo anuncie al aparecer. El color distingue
 * error de exito (`--color-danger` / `--color-success`, ver index.css); el icono repite la
 * misma senal para quien no distingue el color.
 */
export function Alert({ children, variant = 'error' }: { children: ReactNode; variant?: AlertVariant }) {
  return (
    <p
      role="alert"
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${VARIANT_CLASSES[variant]}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        {ICON_PATH[variant]}
      </svg>
      <span>{children}</span>
    </p>
  );
}

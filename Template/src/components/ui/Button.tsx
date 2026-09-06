import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'bg-transparent text-text-h border border-border hover:bg-accent-bg',
};

export const BUTTON_BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border disabled:opacity-50 disabled:cursor-not-allowed';

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${BUTTON_BASE_CLASSES} ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}

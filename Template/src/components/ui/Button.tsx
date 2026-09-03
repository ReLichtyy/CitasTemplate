import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:opacity-90',
  secondary: 'bg-transparent text-text-h border border-border hover:bg-accent-bg',
  ghost: 'bg-transparent text-text hover:text-text-h',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}

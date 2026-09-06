import { Link, type LinkProps } from 'react-router-dom';
import { BUTTON_BASE_CLASSES, BUTTON_VARIANT_CLASSES, type ButtonVariant } from './Button';

type ButtonLinkProps = LinkProps & {
  variant?: ButtonVariant;
};

export function ButtonLink({ variant = 'primary', className = '', ...props }: ButtonLinkProps) {
  return (
    <Link
      className={`${BUTTON_BASE_CLASSES} ${BUTTON_VARIANT_CLASSES[variant]} no-underline ${className}`}
      {...props}
    />
  );
}

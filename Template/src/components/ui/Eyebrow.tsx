import type { ReactNode } from 'react';

type EyebrowProps = {
  children: ReactNode;
  /** `acento` para el que encabeza una seccion; `apagado` para el que solo rotula. */
  tono?: 'acento' | 'apagado';
  className?: string;
  /** Para cuando este eyebrow es el titulo de un dialogo (`aria-labelledby`). */
  id?: string;
};

/**
 * El caption en versalitas que va arriba de un titulo de seccion.
 *
 * Existe porque el par tamano/tracking se repetia entre corchetes en cada seccion que lo
 * usaba, y un valor arbitrario repetido es un token que falta: ahora son `--text-eyebrow`
 * y `--tracking-eyebrow` en `@theme`, y el componente los aplica siempre igual.
 */
export function Eyebrow({ children, tono = 'apagado', className = '', id }: EyebrowProps) {
  return (
    <p
      id={id}
      className={`font-mono text-eyebrow font-medium tracking-eyebrow uppercase ${
        tono === 'acento' ? 'text-accent-ink' : 'text-text-muted'
      } ${className}`}
    >
      {children}
    </p>
  );
}

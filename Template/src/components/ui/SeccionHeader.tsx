import { Eyebrow } from './Eyebrow';

type SeccionHeaderProps = {
  /** Caption en versalitas. El que encabeza una seccion va en acento. */
  eyebrow?: string;
  titulo: string;
  descripcion?: string;
  className?: string;
};

/**
 * Encabezado de seccion de las paginas publicas: eyebrow, titulo y una bajada opcional,
 * centrados y con el mismo ancho maximo siempre.
 *
 * Existe para que dos secciones no se separen de a poco —una con el eyebrow en acento y
 * otra en apagado, una a `max-w-2xl` y otra a `max-w-3xl`—, que es como una landing
 * termina pareciendo dos landings pegadas.
 */
export function SeccionHeader({
  eyebrow,
  titulo,
  descripcion,
  className = '',
}: SeccionHeaderProps) {
  return (
    <div className={`mx-auto flex max-w-2xl flex-col items-center gap-3 text-center ${className}`}>
      {eyebrow && <Eyebrow tono="acento">{eyebrow}</Eyebrow>}
      <h2 className="text-2xl text-balance sm:text-3xl">{titulo}</h2>
      {descripcion && <p className="text-sm text-pretty text-text-muted">{descripcion}</p>}
    </div>
  );
}

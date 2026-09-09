import { CARD_SHELL_CLASSES } from './Card';

/** Barra de carga generica: el tamano lo define quien la usa (`h-4 w-2/3`, etc). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden="true" />;
}

/**
 * Hueco de una card con portada. La foto manda el alto, asi que el placeholder repite su
 * relacion de aspecto: con una de otra forma, la rejilla entera salta al llegar los datos.
 * `aspecto` lo pasa quien la usa, igual que en `CardCover`.
 */
export function SkeletonMediaCard({ aspecto }: { aspecto: string }) {
  return (
    <div className={`${CARD_SHELL_CLASSES} overflow-hidden`}>
      {/* La utilidad `skeleton` en crudo, no el componente: este bloque va a sangre y el
          `rounded-md` que trae `Skeleton` no se puede anular concatenando `rounded-none`. */}
      <div className={`skeleton w-full ${aspecto}`} aria-hidden="true" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}

/** Rejilla de `count` `SkeletonMediaCard`, para reemplazar el spinner en los catalogos. */
export function SkeletonMediaCardGrid({
  count = 3,
  className = '',
  aspecto,
}: {
  count?: number;
  className?: string;
  aspecto: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonMediaCard key={i} aspecto={aspecto} />
      ))}
    </div>
  );
}

import { useState } from 'react';

type ThumbnailProps = {
  src?: string | null;
  /** Iniciales o monograma que se muestra cuando no hay imagen (o cuando falla). */
  fallback: string;
  alt?: string;
  /** Tamano y forma los define quien la usa: `h-12 w-12 rounded-full`, etc. */
  className?: string;
};

// Una fotoUrl guardada en la base puede pudrirse: si la imagen no carga se cae al mismo
// monograma que cuando no hay imagen, para que la card nunca cambie de tamano ni muestre
// el icono de imagen rota.
export function Thumbnail({ src, fallback, alt = '', className = '' }: ThumbnailProps) {
  const [estado, setEstado] = useState({ src, fallo: false });

  if (estado.src !== src) {
    setEstado({ src, fallo: false });
  }

  const clases = `shrink-0 overflow-hidden bg-accent-bg ${className}`;

  if (src && !estado.fallo) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setEstado({ src, fallo: true })}
        className={`object-cover ${clases}`}
      />
    );
  }

  return (
    <span className={`inline-flex items-center justify-center font-semibold text-accent ${clases}`}>
      {fallback}
    </span>
  );
}

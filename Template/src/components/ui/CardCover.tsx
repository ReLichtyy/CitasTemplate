import { Thumbnail } from './Thumbnail';

type CardCoverProps = {
  src?: string | null;
  /** Monograma o iniciales, que llenan la misma caja cuando no hay imagen. */
  fallback: string;
  /** La relacion de aspecto la decide la card que la usa; las dos no miden igual. */
  className?: string;
};

/**
 * Portada de una card: la imagen a sangre, con el foco puesto en el centro.
 *
 * El foco (`foco-imagen` en index.css) baja el brillo de los bordes y sobre todo del pie,
 * que es donde se apoya el texto de la card. Se aplica **solo si hay imagen de verdad**:
 * sobre el fallback —monograma claro sobre `--color-accent-bg`— un oscurecido no se lee
 * como foco, se lee como un error de carga.
 *
 * La condicion es `group-has-[img]` y no el `src` porque una `fotoUrl` guardada puede estar
 * podrida: en ese caso `Thumbnail` ya cayo al monograma y no hay `img` que enfocar. La
 * portada es la unica imagen de estas cards, asi que preguntar por `img` no da falsos
 * positivos.
 *
 * En reposo la foto va algo desaturada y recupera el color al pasar por la card: es lo que
 * hace que el hover se sienta sin mover nada de sitio.
 */
export function CardCover({ src, fallback, className = '' }: CardCoverProps) {
  return (
    <div className={`relative w-full shrink-0 overflow-hidden ${className}`}>
      <Thumbnail
        src={src}
        fallback={fallback}
        className="h-full w-full text-3xl saturate-75 transition-[transform,filter] duration-300 group-hover:scale-105 group-hover:saturate-100 sm:text-4xl"
      />
      <span
        aria-hidden="true"
        className="foco-imagen pointer-events-none absolute inset-0 hidden group-has-[img]:block"
      />
    </div>
  );
}

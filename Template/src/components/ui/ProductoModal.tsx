import { useId } from 'react';
import { ButtonLink } from './ButtonLink';
import { Dialogo } from './Dialogo';
import { Disponibilidad } from './Disponibilidad';
import { Thumbnail } from './Thumbnail';
import { formatPrice } from '../../lib/formatPrice';
import type { CategoriaProducto, Producto } from '../../types/producto';

type ProductoModalProps = {
  /** Nulo cuando no hay nada abierto: el propio producto es el estado del modal. */
  producto: Producto | null;
  categoria?: CategoriaProducto;
  moneda: string;
  locale: string;
  onClose: () => void;
};

/**
 * Modal propio del producto, mas chico que `Modal`.
 *
 * Lo que lo hace compacto no es el ancho sino el cromo que no tiene: la foto ocupa el lugar
 * de la cabecera —con la X y la etiqueta de stock encima— y no hay pie con un boton Cerrar,
 * que en un dialogo de este tamaño es una barra entera gastada en repetir lo que ya hacen la
 * X, Escape y el click afuera.
 *
 * Los datos van en un bloque hundido de pares etiqueta/valor, como el resumen del sistema de
 * diseño: puestos en fila se leen de un vistazo y no como prosa.
 */
export function ProductoModal({
  producto,
  categoria,
  moneda,
  locale,
  onClose,
}: ProductoModalProps) {
  const tituloId = useId();

  return (
    <Dialogo open={producto !== null} onClose={onClose} tituloId={tituloId} className="max-w-sm">
      {producto && (
        <>
          <div className="relative shrink-0">
            {/* Limpia: sin foco ni desaturacion, que son de la card. Aqui la imagen es el
                contenido. Sin `imagenUrl` cae al monograma y llena la misma caja. */}
            <Thumbnail
              src={producto.imagenUrl}
              fallback={producto.nombre.charAt(0).toUpperCase()}
              className="aspect-4/3 w-full text-5xl"
            />

            {/* Ambos chips van sobre fondo opaco con desenfoque: apoyados en una foto
                cualquiera, un fondo translucido los volveria ilegibles. */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface/90 text-text-h backdrop-blur-sm transition-colors hover:bg-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-4"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>

            <Disponibilidad
              disponible={producto.disponible}
              className="absolute bottom-3 left-3"
            />
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            {/* Sin `font-heading font-normal tracking-tight text-text-h`: index.css ya se
                los aplica a todo h2. Repetirlos aqui era pintar cuatro veces lo mismo. */}
            <h2 id={tituloId} className="text-xl sm:text-2xl">
              {producto.nombre}
            </h2>

            <dl className="flex flex-col gap-2 rounded-lg bg-bg p-3.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-text-muted">Contenido</dt>
                <dd className="text-text-h">{producto.presentacion}</dd>
              </div>
              {categoria && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-text-muted">Tipo</dt>
                  <dd className="text-text-h">{categoria.nombre}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-2">
                <dt className="text-text-muted">Precio</dt>
                <dd className="text-lg font-bold tabular-nums text-price">
                  {formatPrice(producto.precio, moneda, locale)}
                </dd>
              </div>
            </dl>

            {producto.descripcion && (
              <p className="text-sm leading-relaxed">{producto.descripcion}</p>
            )}

            {/* Un agotado no ofrece agendar: el chip de arriba ya dijo que no hay, y un CTA
                que lo contradice hace dudar de los dos. Se explica en su lugar, porque un
                boton deshabilitado sin motivo se lee como una pagina rota. */}
            {producto.disponible ? (
              <ButtonLink to="/citas/reservar" className="w-full">
                Consultar en una cita
              </ButtonLink>
            ) : (
              <p className="m-0 rounded-lg border border-border bg-bg p-3 text-center text-sm text-text-muted">
                Sin existencias por ahora. Preguntenos en su proxima cita cuando vuelve.
              </p>
            )}
          </div>
        </>
      )}
    </Dialogo>
  );
}

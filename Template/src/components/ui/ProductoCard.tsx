import { CARD_MEDIA_INTERACTIVE_CLASSES } from './Card';
import { CardCover } from './CardCover';
import { CardDetailIcon } from './CardDetailIcon';
import { Disponibilidad } from './Disponibilidad';
import { formatPrice } from '../../lib/formatPrice';
import type { Producto } from '../../lib/productosPlaceholder';

type ProductoCardProps = {
  producto: Producto;
  moneda: string;
  locale: string;
  /** Abre el modal de detalle. */
  onSelect: () => void;
};

// Misma anatomia que ServicioCard —portada, nombre, y el precio en su propia fila— porque es
// la misma pregunta: que es y cuanto cuesta. Lo unico que cambia es el dato callado de la
// izquierda: alli la duracion, aqui el contenido del envase.
export function ProductoCard({ producto, moneda, locale, onSelect }: ProductoCardProps) {
  const { nombre, precio, imagenUrl, presentacion, disponible } = producto;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${CARD_MEDIA_INTERACTIVE_CLASSES} flex flex-col`}
    >
      {/* La etiqueta va sobre la portada y no junto al precio: es lo que decide si vale la
          pena abrir la card, asi que se ve antes de leer nada. */}
      <div className="relative shrink-0">
        <CardCover
          src={imagenUrl}
          fallback={nombre.charAt(0).toUpperCase()}
          className="aspect-4/3"
        />
        <Disponibilidad disponible={disponible} className="absolute top-3 right-3" />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 font-semibold tracking-tight text-text-h">
            {nombre}
          </p>
          <CardDetailIcon />
        </div>
        <div className="mt-auto flex items-baseline justify-between gap-3">
          <span className="whitespace-nowrap text-sm text-text-muted">{presentacion}</span>
          <span className="whitespace-nowrap text-lg font-bold tabular-nums text-price">
            {formatPrice(precio, moneda, locale)}
          </span>
        </div>
      </div>
    </button>
  );
}

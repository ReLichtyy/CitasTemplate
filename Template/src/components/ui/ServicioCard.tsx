import { CARD_INTERACTIVE_CLASSES } from './Card';
import { CardDetailIcon } from './CardDetailIcon';
import { Thumbnail } from './Thumbnail';
import { formatDuration } from '../../lib/formatDuration';
import { formatPrice } from '../../lib/formatPrice';
import type { Servicio } from '../../types/catalogo';

type ServicioCardProps = {
  servicio: Servicio;
  moneda: string;
  locale: string;
  /** Abre el modal de detalle. */
  onSelect: () => void;
};

export function ServicioCard({ servicio, moneda, locale, onSelect }: ServicioCardProps) {
  const { nombre, duracionMinutos, precio, imagenUrl } = servicio;

  return (
    <button type="button" onClick={onSelect} className={CARD_INTERACTIVE_CLASSES}>
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Sin imagenUrl cae al monograma del nombre, asi todas las cards miden igual y la
            rejilla no se rompe (la objecion de spec/07 a poner foto en el catalogo). */}
        <Thumbnail
          src={imagenUrl}
          fallback={nombre.charAt(0).toUpperCase()}
          className="h-12 w-12 rounded-lg text-sm sm:h-14 sm:w-14 sm:text-base"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="line-clamp-2 text-base font-semibold tracking-tight text-text-h">
            {nombre}
          </p>
          <div className="flex items-baseline justify-between gap-3">
            <span className="whitespace-nowrap text-sm text-text-muted">
              {formatDuration(duracionMinutos)}
            </span>
            <span className="whitespace-nowrap text-lg font-bold tabular-nums text-price">
              {formatPrice(precio, moneda, locale)}
            </span>
          </div>
        </div>
        <CardDetailIcon />
      </div>
    </button>
  );
}

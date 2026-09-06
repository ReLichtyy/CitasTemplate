import { CARD_BASE_CLASSES, CARD_INTERACTIVE_CLASSES } from './Card';
import { CardDetailIcon } from './CardDetailIcon';
import { Thumbnail } from './Thumbnail';
import { formatDuration } from '../../lib/formatDuration';
import { formatPrice } from '../../lib/formatPrice';

type ServicioCardProps = {
  nombre: string;
  duracionMinutos: number;
  precio: string;
  moneda: string;
  locale: string;
  /** Opcional en el modelo: sin ella la miniatura cae al monograma del nombre, asi que
   *  todas las cards miden igual y la rejilla no se rompe (la objecion de spec/07). */
  imagenUrl?: string | null;
  /** Abre el modal de detalle. Sin handler la card es estatica, no interactiva. */
  onSelect?: () => void;
};

export function ServicioCard({
  nombre,
  duracionMinutos,
  precio,
  moneda,
  locale,
  imagenUrl,
  onSelect,
}: ServicioCardProps) {
  const contenido = (
    <div className="flex items-start gap-3 sm:gap-4">
      <Thumbnail
        src={imagenUrl}
        fallback={nombre.charAt(0).toUpperCase()}
        className="h-12 w-12 rounded-lg text-sm sm:h-14 sm:w-14 sm:text-base"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="line-clamp-2 text-base font-medium text-text-h">{nombre}</p>
        <div className="flex items-baseline justify-between gap-3">
          <span className="whitespace-nowrap text-sm text-text-muted">
            {formatDuration(duracionMinutos)}
          </span>
          <span className="whitespace-nowrap text-lg font-bold tabular-nums text-price">
            {formatPrice(precio, moneda, locale)}
          </span>
        </div>
      </div>
      {onSelect && <CardDetailIcon />}
    </div>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={CARD_INTERACTIVE_CLASSES}>
        {contenido}
      </button>
    );
  }

  return <div className={CARD_BASE_CLASSES}>{contenido}</div>;
}

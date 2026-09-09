import { CARD_MEDIA_INTERACTIVE_CLASSES } from './Card';
import { CardCover } from './CardCover';
import { CardDetailIcon } from './CardDetailIcon';
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
    <button
      type="button"
      onClick={onSelect}
      className={`${CARD_MEDIA_INTERACTIVE_CLASSES} flex flex-col`}
    >
      {/* Apaisada, no vertical: un servicio no es un retrato. Sin imagenUrl cae al monograma
          del nombre, que llena la misma caja — es la condicion que hace que la rejilla no se
          vea rota cuando solo algunos servicios tienen foto (07-card-servicio.md). */}
      <CardCover
        src={imagenUrl}
        fallback={nombre.charAt(0).toUpperCase()}
        className="aspect-4/3"
      />

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* El precio no comparte fila con el nombre: un nombre largo empuja hacia abajo,
            nunca aplasta el precio. */}
        <div className="flex items-start gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 font-semibold tracking-tight text-text-h">
            {nombre}
          </p>
          <CardDetailIcon />
        </div>
        <div className="mt-auto flex items-baseline justify-between gap-3">
          <span className="whitespace-nowrap text-sm text-text-muted">
            {formatDuration(duracionMinutos)}
          </span>
          <span className="whitespace-nowrap text-lg font-bold tabular-nums text-price">
            {formatPrice(precio, moneda, locale)}
          </span>
        </div>
      </div>
    </button>
  );
}

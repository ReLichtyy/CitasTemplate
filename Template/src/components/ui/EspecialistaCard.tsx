import { CARD_BASE_CLASSES, CARD_INTERACTIVE_CLASSES } from './Card';
import { CardDetailIcon } from './CardDetailIcon';
import { Thumbnail } from './Thumbnail';
import { iniciales, nombreCompleto } from '../../lib/especialista';

type EspecialistaCardProps = {
  nombre: string;
  apellido?: string | null;
  especialidad?: string | null;
  fotoUrl?: string | null;
  /** Abre el modal de detalle. Sin handler la card es estatica, no interactiva. */
  onSelect?: () => void;
};

export function EspecialistaCard({
  nombre,
  apellido,
  especialidad,
  fotoUrl,
  onSelect,
}: EspecialistaCardProps) {
  const contenido = (
    <div className="flex items-center gap-3 sm:gap-4">
      <Thumbnail
        src={fotoUrl}
        fallback={iniciales(nombre, apellido)}
        className="h-12 w-12 rounded-full text-sm sm:h-14 sm:w-14 sm:text-base"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-base font-medium text-text-h">
          {nombreCompleto(nombre, apellido)}
        </p>
        {especialidad && <p className="text-sm text-text-muted">{especialidad}</p>}
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

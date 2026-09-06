import { CARD_INTERACTIVE_CLASSES } from './Card';
import { CardDetailIcon } from './CardDetailIcon';
import { StarIcon } from './StarIcon';
import { Thumbnail } from './Thumbnail';
import { iniciales, nombreCompleto } from '../../lib/especialista';
import type { Especialista } from '../../types/catalogo';

type EspecialistaCardProps = {
  especialista: Especialista;
  /** Abre el modal de detalle, que incluye el rating y las ultimas resenas. */
  onSelect: () => void;
};

export function EspecialistaCard({ especialista, onSelect }: EspecialistaCardProps) {
  const { nombre, apellido, especialidad, fotoUrl, rating } = especialista;
  const nombreVisible = nombreCompleto(nombre, apellido);

  return (
    <button type="button" onClick={onSelect} className={CARD_INTERACTIVE_CLASSES}>
      <div className="flex items-center gap-2">
        {/* 48 px fijo (spec/08 pedia 56 desde sm): con el rating en la misma fila, esos
            8 px extra son los que le faltaban al nombre para entrar en una linea. */}
        <Thumbnail
          src={fotoUrl}
          fallback={iniciales(nombre, apellido)}
          className="h-12 w-12 rounded-full text-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-base font-semibold tracking-tight text-text-h">
            {nombreVisible}
          </p>
          {/* Una linea fija: con el rating compitiendo por el ancho, dejarla envolver hacia
              abajo es lo que hacia ver la card saturada. */}
          {especialidad && <p className="line-clamp-1 text-sm text-text-muted">{especialidad}</p>}
        </div>

        {/* Dato, no accion: con un unico modal el rating dejo de necesitar boton propio,
            y la card vuelve a ser un solo <button>. */}
        {rating && (
          <span className="inline-flex shrink-0 items-center gap-1 px-1 text-sm font-medium text-text-h">
            <StarIcon className="h-3.5 w-3.5 text-price" />
            <span className="tabular-nums">{rating.promedio.toFixed(1)}</span>
          </span>
        )}

        <CardDetailIcon />
      </div>
    </button>
  );
}

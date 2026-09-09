import { CARD_MEDIA_INTERACTIVE_CLASSES } from './Card';
import { CardCover } from './CardCover';
import { CardDetailIcon } from './CardDetailIcon';
import { StarIcon } from './StarIcon';
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
    <button
      type="button"
      onClick={onSelect}
      className={`${CARD_MEDIA_INTERACTIVE_CLASSES} flex flex-col`}
    >
      {/* Retrato a sangre. El hueco es el mismo con foto o con iniciales —el fallback llena
          la misma caja— asi que la rejilla sigue pareja aunque solo algunos tengan foto, que
          es la condicion que 08-pagina-especialistas.md le pone a la imagen del especialista.
          Cuadrado en telefono y vertical desde `sm`: a una columna, 4/5 obliga a scrollear
          una card entera por persona. */}
      <CardCover
        src={fotoUrl}
        fallback={iniciales(nombre, apellido)}
        className="aspect-square sm:aspect-4/5"
      />

      <div className="flex flex-1 items-start gap-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold tracking-tight text-text-h">{nombreVisible}</p>
          {/* Una linea fija: el nombre ya puede ocupar dos, y dejar que la especialidad
              envuelva es lo que hacia ver la card saturada. */}
          {especialidad && (
            <p className="mt-0.5 line-clamp-1 text-sm text-text-muted">{especialidad}</p>
          )}
        </div>

        {/* Dato, no accion: con un unico modal el rating dejo de necesitar boton propio,
            y la card vuelve a ser un solo <button>. */}
        {rating && (
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-text-h">
            <StarIcon className="h-3.5 w-3.5 text-price" />
            <span className="tabular-nums">{rating.promedio.toFixed(1)}</span>
          </span>
        )}

        <CardDetailIcon />
      </div>
    </button>
  );
}

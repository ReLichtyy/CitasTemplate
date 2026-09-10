import { Link } from 'react-router-dom';
import { formatFechaLarga, formatRangoHoras, yaPaso } from '../../lib/formatFechaHora';
import { formatPrice } from '../../lib/formatPrice';
import { CARD_MEDIA_INTERACTIVE_CLASSES } from './Card';
import { CardDetailIcon } from './CardDetailIcon';
import { EstadoBadge } from './EstadoBadge';
import type { Cita } from '../../types/cita';

/**
 * Una cita en la lista.
 *
 * El orden lo manda lo que se busca al repasar una agenda: **cuando**, luego que y con
 * quien, y el importe al final. El nombre del servicio es el titulo, no la fecha, porque
 * la fecha ya encabeza el grupo del dia en el listado.
 *
 * Entera es un enlace a la ficha: el area tactil es la card completa y no un "ver mas"
 * de 60 px. Por eso el `<article>` va dentro del `<Link>` y no al reves.
 */
export function CitaCard({
  cita,
  /** Se pinta el cliente (vista del negocio) o el profesional (vista del cliente). */
  mostrarCliente,
  moneda,
  locale,
}: {
  cita: Cita;
  mostrarCliente: boolean;
  moneda: string;
  locale: string;
}) {
  const contraparte = mostrarCliente ? cita.cliente : cita.empleado.usuario;
  const nombreContraparte = [contraparte.nombre, contraparte.apellido].filter(Boolean).join(' ');

  // Una cita pasada se atenua, pero solo si ya no espera nada de nadie: una PENDIENTE de
  // ayer es precisamente la que hay que ver. `esFinal` lo dice el catalogo.
  const apagada = yaPaso(cita.inicio) && cita.estado.esFinal;

  return (
    <Link
      to={`/citas/${cita.id}`}
      className={`${CARD_MEDIA_INTERACTIVE_CLASSES} block no-underline ${apagada ? 'opacity-65' : ''}`}
    >
      <article className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {/* `time` con `dateTime` en ISO: el texto es para leer, el atributo es lo que
                un lector de pantalla o un buscador interpretan sin ambiguedad de zona. */}
            <time
              dateTime={cita.inicio}
              className="text-sm font-semibold tabular-nums text-text-h"
            >
              {formatRangoHoras(cita.inicio, cita.fin, locale)}
            </time>
            <h3 className="truncate text-base sm:text-lg">{cita.servicio.nombre}</h3>
          </div>
          {/* El chevron acompana al estado y no al titulo: en una fila estrecha el titulo
              ya se recorta, y meterle un icono al lado le quita ancho al texto. */}
          <div className="flex shrink-0 items-center gap-2">
            <EstadoBadge estado={cita.estado} />
            <CardDetailIcon />
          </div>
        </div>

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <dt className="shrink-0 text-text-muted">{mostrarCliente ? 'Cliente' : 'Atiende'}</dt>
            <dd className="truncate font-medium text-text-h">{nombreContraparte}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="sr-only">Total</dt>
            <dd className="font-medium tabular-nums text-price">
              {formatPrice(cita.costoTotal, moneda, locale)}
            </dd>
          </div>
        </dl>

        {/* El dia no se repite en cada card cuando el listado ya agrupa por dia; se pinta
            solo si esta card viaja suelta. Lo decide quien la usa via `sr-only`, no aqui:
            para un lector de pantalla el encabezado del grupo queda lejos de la fila. */}
        <span className="sr-only">{formatFechaLarga(cita.inicio, locale)}</span>
      </article>
    </Link>
  );
}

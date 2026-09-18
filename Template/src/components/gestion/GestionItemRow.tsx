import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CARD_INTERACTIVE_CLASSES } from '../ui/Card';
import { CardDetailIcon } from '../ui/CardDetailIcon';

/**
 * La fila de listado de gestion: monograma crema (o foto), titulo y subtitulo al centro,
 * metricas y precio a la derecha, chevron si la fila navega, y las acciones del ADMIN al
 * costado.
 *
 * El cuerpo es un `<Link>` y las acciones van **fuera** de el: un boton dentro de un
 * enlace dispara la navegacion al pulsarlo. Las pantallas que no navegan no pasan `a`, y
 * entonces no llevan chevron — el icono es la promesa de que tocar hace algo.
 */
export function GestionItemRow({
  imagen,
  monograma,
  redondo = false,
  titulo,
  subtitulo,
  meta,
  precio,
  chip,
  a,
  acciones,
  atenuada = false,
}: {
  /** La foto del registro, si tiene. Sin ella, el monograma. */
  imagen?: string | null;
  /** Lo que se escribe en el monograma: una inicial, dos, lo que la pantalla elija. */
  monograma: string;
  /** Los profesionales son circulares; el catalogo, cuadrado. */
  redondo?: boolean;
  titulo: string;
  subtitulo?: ReactNode;
  /** Las metricas derechas: duracion, conteo, rating. Texto corto y discreto. */
  meta?: ReactNode;
  /** El importe, ya formateado por la pantalla. Se pinta en el teal del precio. */
  precio?: ReactNode;
  /** La pildora de estado, cuando hay algo que distinguir de lejos. */
  chip?: ReactNode;
  /** A donde navega la fila. Sin chevron cuando no navega. */
  a?: string;
  /** Editar, despublicar, dar de baja: los botones del ADMIN. */
  acciones?: ReactNode;
  /** La fila que ya no participa: despublicado, dado de baja, pasado. */
  atenuada?: boolean;
}) {
  const cuerpo = (
    <>
      {imagen ? (
        <img
          src={imagen}
          alt=""
          className={`size-14 shrink-0 object-cover ${redondo ? 'rounded-full' : 'rounded-lg'}`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`flex size-14 shrink-0 items-center justify-center bg-crema-suave font-heading text-2xl text-crema-ink ${
            redondo ? 'rounded-full' : 'rounded-lg'
          }`}
        >
          {monograma}
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-text-h">{titulo}</span>
          {chip}
        </span>
        {subtitulo && (
          <span className="block truncate text-sm text-text-muted">{subtitulo}</span>
        )}
      </span>

      {meta && (
        <span className="hidden shrink-0 items-center gap-3 text-sm text-text-muted sm:flex">
          {meta}
        </span>
      )}
      {precio && (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-price">{precio}</span>
      )}
      {a && <CardDetailIcon />}
    </>
  );

  return (
    <div
      className={`${CARD_INTERACTIVE_CLASSES} flex items-center gap-4 ${atenuada ? 'opacity-70' : ''}`}
    >
      {a ? (
        <Link to={a} className="flex min-w-0 flex-1 items-center gap-4 no-underline">
          {cuerpo}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-4">{cuerpo}</div>
      )}
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CARD_INTERACTIVE_CLASSES } from '../ui/Card';
import { CardDetailIcon } from '../ui/CardDetailIcon';

/**
 * La fila de listado de gestion: monograma crema (o foto) a la izquierda, la informacion
 * en columna al centro y las acciones del ADMIN a la derecha. Tres piezas en una sola
 * linea de flexbox — en un telefono de 360 px no hay ancho para mas columnas, y lo que
 * no es esencial (las metricas) se reserva para `sm`.
 *
 * El precio y la pildora de estado viven en la fila inferior de la columna central, junto
 * al subtitulo: el titulo no compite con nadie por el ancho y el precio nunca queda
 * empujado por los botones de accion.
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
  /** El detalle muted de la fila: categoria y presentacion, especialidad, descripcion. */
  subtitulo?: ReactNode;
  /** Las metricas que solo entran desde `sm`: rating, conteo. Texto corto y discreto. */
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

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="truncate text-sm font-semibold text-text-h sm:text-base">{titulo}</span>
        {/* La fila inferior junta lo que se ve de un vistazo — el importe y el estado —
            y el subtitulo trunca a su lado: dos lineas por fila, ni una mas. */}
        {(precio || subtitulo || chip) && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted sm:text-sm">
            {precio && (
              <span className="shrink-0 font-semibold tabular-nums text-price">{precio}</span>
            )}
            {subtitulo && <span className="min-w-0 truncate">{subtitulo}</span>}
            {chip}
          </span>
        )}
      </span>

      {meta && (
        <span className="hidden shrink-0 items-center gap-3 text-sm text-text-muted sm:flex">
          {meta}
        </span>
      )}
      {a && <CardDetailIcon />}
    </>
  );

  return (
    <div
      className={`${CARD_INTERACTIVE_CLASSES} flex items-center gap-3 sm:gap-4 ${atenuada ? 'opacity-70' : ''}`}
    >
      {a ? (
        <Link to={a} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4 no-underline">
          {cuerpo}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">{cuerpo}</div>
      )}
      {acciones && <div className="flex shrink-0 gap-2">{acciones}</div>}
    </div>
  );
}

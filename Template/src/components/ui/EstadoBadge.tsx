import type { EstadoCita } from '../../types/cita';

/**
 * Tonos disponibles. No hay un token de "aviso" en la paleta (ver `index.css`), asi que
 * pendiente toma el acento: es el estado que espera una accion, que es justo lo que el
 * acento senala en el resto del producto.
 */
type Tono = 'acento' | 'exito' | 'peligro' | 'neutro';

const TONO_CLASSES: Record<Tono, string> = {
  acento: 'border-accent-border text-accent',
  exito: 'border-success-border text-success',
  peligro: 'border-danger-border text-danger',
  neutro: 'border-border text-text-muted',
};

const PUNTO_CLASSES: Record<Tono, string> = {
  acento: 'bg-accent',
  exito: 'bg-success',
  peligro: 'bg-danger',
  neutro: 'bg-text-muted',
};

/**
 * El color es presentacion, y solo eso: **la regla de que se puede hacer con la cita no
 * sale de aqui**, sale de los indicadores de `EstadoCita`. Este mapa existe unicamente
 * para que "Cancelada" no se pinte igual que "Confirmada".
 *
 * Cancelada va en neutro y no en rojo: cancelar es una salida prevista, no un fallo. El
 * rojo se reserva para `NO_ASISTIO`, que es lo unico que el negocio necesita ver de lejos
 * en una agenda.
 *
 * Un codigo que no este aqui cae en neutro y se sigue leyendo bien: el catalogo de
 * `EstadoCita` es una tabla, alguien puede agregar una fila, y eso no puede romper la
 * lista. Por eso tampoco es una union de literales.
 */
const TONO_POR_CODIGO: Record<string, Tono> = {
  PENDIENTE: 'acento',
  CONFIRMADA: 'exito',
  ATENDIDA: 'neutro',
  CANCELADA: 'neutro',
  NO_ASISTIO: 'peligro',
};

/**
 * Etiqueta de estado de una cita: punto de color mas texto, como `Disponibilidad`.
 *
 * El punto no lleva la informacion solo —el nombre la dice igual— porque un estado que
 * solo se distingue por color no se distingue. Y lo que se pinta es `estado.nombre`, que
 * lo redacta el catalogo, nunca `estado.codigo`: `NO_ASISTIO` no es texto de interfaz.
 */
export function EstadoBadge({ estado, className = '' }: { estado: EstadoCita; className?: string }) {
  const tono = TONO_POR_CODIGO[estado.codigo] ?? 'neutro';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border bg-surface/90 px-3 py-1 text-xs font-medium backdrop-blur-sm ${TONO_CLASSES[tono]} ${className}`}
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${PUNTO_CLASSES[tono]}`} />
      {estado.nombre}
    </span>
  );
}

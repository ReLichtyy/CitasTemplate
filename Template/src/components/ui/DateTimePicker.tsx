import { useMemo } from 'react';
import { desdeISO, aISO, hoyEnISO } from '../../lib/fechaISO';

/** Una hora que el API dio por libre. `valor` es el instante ISO que se manda al reservar. */
export type OpcionHora = { valor: string; etiqueta: string };

type DateTimePickerProps = {
  /** Dia elegido, ISO corto. */
  fecha: string;
  onFechaChange: (iso: string) => void;
  /** Nada anterior a este dia se ofrece. */
  minFecha?: string;
  locale: string;
  /** Instante elegido, o cadena vacia. */
  hora: string;
  onHoraChange: (valor: string) => void;
  /** Horas libres segun el API. `null` mientras no haya respuesta para esta consulta. */
  opciones: OpcionHora[] | null;
  cargando?: boolean;
  /** Zona del negocio: las horas de abajo son de ella, no las del telefono de quien reserva. */
  zonaHoraria?: string | null;
};

const ETIQUETA_CLASSES = 'font-mono text-eyebrow font-medium tracking-eyebrow text-text-muted uppercase';

// Dos semanas y media: suficiente ventana para elegir sin volverse un calendario entero,
// y corta como para que la franja no obligue a scrollear de mas en un telefono.
const DIAS_VISIBLES = 18;

function agregarDias(iso: string, dias: number): string {
  const { anio, mes, dia } = desdeISO(iso);
  const movido = new Date(anio, mes, dia + dias);
  return aISO(movido.getFullYear(), movido.getMonth(), movido.getDate());
}

/**
 * Fecha y hora del turno.
 *
 * La fecha es una franja horizontal de dias (no un calendario emergente): quien reserva
 * elige dentro de una ventana corta, y ver los dias uno al lado del otro deja notar de
 * entrada cuales caen finde sin tener que abrir nada. La hora **no** es un campo libre: las
 * opciones son las que devolvio `GET /citas/disponibilidad` para ese profesional y ese dia.
 * Dejar escribir una hora cualquiera seria inventar disponibilidad del lado del cliente, que
 * es justo lo que ARCHITECTURE.md prohibe — el calendario de cada empleado lo resuelve el
 * servidor.
 */
export function DateTimePicker({
  fecha,
  onFechaChange,
  minFecha,
  locale,
  hora,
  onHoraChange,
  opciones,
  cargando = false,
  zonaHoraria,
}: DateTimePickerProps) {
  const base = minFecha || hoyEnISO();
  const hoy = hoyEnISO();

  const dias = useMemo(() => {
    const formatoDow = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: DIAS_VISIBLES }, (_, indice) => {
      const iso = agregarDias(base, indice);
      const { anio, mes, dia } = desdeISO(iso);
      return {
        iso,
        dow: formatoDow.format(new Date(anio, mes, dia)),
        dia,
        esHoy: iso === hoy,
      };
    });
  }, [base, hoy, locale]);

  const mesVisible = useMemo(() => {
    const { anio, mes, dia } = desdeISO(fecha || base);
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(anio, mes, dia),
    );
  }, [fecha, base, locale]);

  const sinHorarios = !cargando && opciones?.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className={ETIQUETA_CLASSES}>Fecha · {mesVisible}</span>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {dias.map((d) => {
            const elegido = d.iso === fecha;
            return (
              <button
                key={d.iso}
                type="button"
                aria-pressed={elegido}
                onClick={() => onFechaChange(d.iso)}
                className={`flex min-h-[68px] w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2.5 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border ${
                  elegido
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-border bg-surface text-text hover:border-accent-border hover:bg-accent-bg'
                }`}
              >
                <span
                  className={`text-[10px] font-medium tracking-wide uppercase ${elegido ? 'text-accent-fg/80' : 'text-text-muted'}`}
                >
                  {d.dow}
                </span>
                <span className="text-lg font-semibold tabular-nums">{d.dia}</span>
                <span
                  className={`text-[10px] ${elegido ? 'text-accent-fg/80' : 'text-text-muted'}`}
                >
                  {d.esHoy ? 'Hoy' : ' '}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className={ETIQUETA_CLASSES}>Hora</span>
        {cargando && (
          <p className="mt-3 flex items-center gap-2 text-sm text-text">
            <span
              aria-hidden="true"
              className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent"
            />
            Buscando horarios...
          </p>
        )}
        {!cargando && opciones && opciones.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {opciones.map((opcion) => {
              const elegida = opcion.valor === hora;
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => onHoraChange(opcion.valor)}
                  className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-1 text-sm tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border ${
                    elegida
                      ? 'border-accent bg-accent font-semibold text-accent-fg'
                      : 'border-border text-text hover:border-accent-border hover:bg-accent-bg hover:text-text-h'
                  }`}
                >
                  {opcion.etiqueta}
                </button>
              );
            })}
          </div>
        )}
        {!cargando && !sinHorarios && opciones === null && (
          <p className="mt-3 text-sm text-text-muted">Elegi una fecha para ver las horas libres.</p>
        )}
        {zonaHoraria && !cargando && (
          <p className="mt-2 text-xs text-text-muted">Hora de {zonaHoraria}</p>
        )}
      </div>
    </div>
  );
}

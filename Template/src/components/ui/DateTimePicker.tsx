import { useState } from 'react';
import { Calendar } from './Calendar';
import { Popover } from './Popover';
import { formatFecha } from '../../lib/formatFecha';

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

const DISPARADOR_CLASSES =
  'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm transition-[border-color,background-color,box-shadow] duration-150 hover:border-accent-border hover:bg-accent-bg/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border aria-expanded:border-accent-border aria-expanded:ring-2 aria-expanded:ring-accent-border disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-surface';

const ETIQUETA_CLASSES = 'text-xs font-medium tracking-wide text-text-muted uppercase';

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-text-muted"
      aria-hidden="true"
    >
      <path d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-text-muted"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function ChevronDownIcon({ abierto }: { abierto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-4 shrink-0 text-text-muted transition-transform duration-200 ${
        abierto ? 'rotate-180' : ''
      }`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Fecha y hora en una sola fila: dos campos que se leen como uno.
 *
 * La hora **no** es un campo libre: las opciones son las que devolvio
 * `GET /citas/disponibilidad` para ese profesional y ese dia. Dejar escribir una hora
 * cualquiera seria inventar disponibilidad del lado del cliente, que es justo lo que
 * ARCHITECTURE.md prohibe — el calendario de cada empleado lo resuelve el servidor.
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
  const [abiertoFecha, setAbiertoFecha] = useState(false);
  const [abiertaHora, setAbiertaHora] = useState(false);

  const sinHorarios = !cargando && opciones?.length === 0;
  const horaElegida = opciones?.find((opcion) => opcion.valor === hora) ?? null;

  const textoHora = cargando
    ? 'Buscando...'
    : sinHorarios
      ? 'Sin horarios'
      : (horaElegida?.etiqueta ?? 'Elegir hora');

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex flex-col gap-1.5 sm:w-56">
        <span className={ETIQUETA_CLASSES}>Fecha</span>
        <Popover
          open={abiertoFecha}
          onOpenChange={setAbiertoFecha}
          label="Elegir fecha"
          triggerAriaLabel={fecha ? `Fecha: ${formatFecha(fecha, locale)}` : 'Elegir fecha'}
          triggerClassName={DISPARADOR_CLASSES}
          trigger={
            <>
              <span className="flex min-w-0 items-center gap-2">
                <CalendarIcon />
                <span className="truncate text-text-h">
                  {fecha ? formatFecha(fecha, locale) : 'Elegir fecha'}
                </span>
              </span>
              <ChevronDownIcon abierto={abiertoFecha} />
            </>
          }
        >
          <Calendar
            value={fecha}
            min={minFecha}
            locale={locale}
            onSelect={(iso) => {
              onFechaChange(iso);
              setAbiertoFecha(false);
            }}
          />
        </Popover>
      </div>

      <div className="flex flex-col gap-1.5 sm:w-48">
        <span className={ETIQUETA_CLASSES}>Hora</span>
        <Popover
          open={abiertaHora}
          onOpenChange={setAbiertaHora}
          disabled={cargando || !opciones || opciones.length === 0}
          label="Elegir hora"
          triggerAriaLabel={horaElegida ? `Hora: ${horaElegida.etiqueta}` : 'Elegir hora'}
          triggerClassName={DISPARADOR_CLASSES}
          panelClassName="max-h-72 overflow-y-auto"
          trigger={
            <>
              <span className="flex min-w-0 items-center gap-2">
                <ClockIcon />
                <span
                  className={`truncate tabular-nums ${horaElegida ? 'text-text-h' : 'text-text'}`}
                >
                  {textoHora}
                </span>
              </span>
              {cargando ? (
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent"
                />
              ) : (
                <ChevronDownIcon abierto={abiertaHora} />
              )}
            </>
          }
        >
          <div className="grid w-56 grid-cols-3 gap-1.5">
            {opciones?.map((opcion) => {
              const elegida = opcion.valor === hora;
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => {
                    onHoraChange(opcion.valor);
                    setAbiertaHora(false);
                  }}
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
        </Popover>
        {zonaHoraria && !cargando && (
          <span className="text-xs text-text-muted">Hora de {zonaHoraria}</span>
        )}
      </div>
    </div>
  );
}

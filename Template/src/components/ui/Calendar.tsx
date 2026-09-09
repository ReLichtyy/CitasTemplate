import { useMemo, useState } from 'react';
import { aISO, desdeISO, hoyEnISO } from '../../lib/fechaISO';

type CalendarProps = {
  /** Dia elegido en ISO corto (`2026-08-14`). Vacio si todavia no hay eleccion. */
  value: string;
  onSelect: (iso: string) => void;
  /** Nada anterior a este dia se puede elegir. Una cita no se agenda hacia atras. */
  min?: string;
  locale: string;
};

type MesVisible = { anio: number; mes: number };

// 2024-01-01 fue lunes: sirve de semana patron para sacar los nombres del locale sin
// hardcodear ningun idioma.
function nombresDeDia(locale: string): string[] {
  const formato = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  return Array.from({ length: 7 }, (_, indice) => formato.format(new Date(2024, 0, 1 + indice)));
}

function mesDe(iso: string): MesVisible {
  const { anio, mes } = desdeISO(iso);
  return { anio, mes };
}

function corrido({ anio, mes }: MesVisible, pasos: number): MesVisible {
  const movido = new Date(anio, mes + pasos, 1);
  return { anio: movido.getFullYear(), mes: movido.getMonth() };
}

const CELDA_CLASSES =
  'inline-flex h-11 w-10 items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border sm:w-11';

const NAV_CLASSES =
  'inline-flex size-9 items-center justify-center rounded-lg text-text transition-colors hover:bg-accent-bg hover:text-text-h focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-text';

function ChevronIcon({ hacia }: { hacia: 'izquierda' | 'derecha' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d={hacia === 'izquierda' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
    </svg>
  );
}

/**
 * Rejilla de un mes, sin dependencias. Semana de lunes a domingo y los nombres de dia y
 * de mes salidos de `Intl` con el locale del negocio, asi que cambiar de idioma no toca
 * este archivo.
 */
export function Calendar({ value, onSelect, min, locale }: CalendarProps) {
  const hoy = hoyEnISO();
  const [visible, setVisible] = useState<MesVisible>(() => mesDe(value || min || hoy));

  // Si la fecha cambia desde afuera (otro paso del formulario la reinicia), el calendario
  // se mueve al mes de esa fecha. Se ajusta en render y no en un efecto: un efecto pintaria
  // primero el mes viejo y despues el correcto.
  const [ancla, setAncla] = useState(value);
  if (ancla !== value) {
    setAncla(value);
    if (value) {
      setVisible(mesDe(value));
    }
  }

  const diasDeLaSemana = useMemo(() => nombresDeDia(locale), [locale]);
  const tituloMes = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        new Date(visible.anio, visible.mes, 1),
      ),
    [locale, visible],
  );

  const diasDelMes = new Date(visible.anio, visible.mes + 1, 0).getDate();
  // getDay() cuenta desde el domingo; la semana empieza el lunes, de ahi el corrimiento.
  const huecosIniciales = (new Date(visible.anio, visible.mes, 1).getDay() + 6) % 7;

  const primeroDelMes = aISO(visible.anio, visible.mes, 1);
  const ultimoDelMes = aISO(visible.anio, visible.mes, diasDelMes);
  // Comparar cadenas ISO es comparar fechas: el formato esta ordenado por diseno.
  const hayMesAnterior = !min || min < primeroDelMes;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setVisible((actual) => corrido(actual, -1))}
          disabled={!hayMesAnterior}
          aria-label="Mes anterior"
          className={NAV_CLASSES}
        >
          <ChevronIcon hacia="izquierda" />
        </button>
        {/* aria-live: al navegar de mes, el lector anuncia el mes nuevo sin mover el foco. */}
        <span aria-live="polite" className="text-sm font-semibold text-text-h capitalize">
          {tituloMes}
        </span>
        <button
          type="button"
          onClick={() => setVisible((actual) => corrido(actual, 1))}
          aria-label="Mes siguiente"
          className={NAV_CLASSES}
        >
          <ChevronIcon hacia="derecha" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {diasDeLaSemana.map((dia, indice) => (
          <span
            key={indice}
            aria-hidden="true"
            className="inline-flex h-8 w-10 items-center justify-center text-xs font-medium text-text-muted uppercase sm:w-11"
          >
            {dia}
          </span>
        ))}

        {Array.from({ length: huecosIniciales }, (_, indice) => (
          <span key={`hueco-${indice}`} aria-hidden="true" className="h-11 w-10 sm:w-11" />
        ))}

        {Array.from({ length: diasDelMes }, (_, indice) => {
          const dia = indice + 1;
          const iso = aISO(visible.anio, visible.mes, dia);
          const bloqueado = !!min && iso < min;
          const elegido = iso === value;
          const esHoy = iso === hoy;

          const estado = bloqueado
            ? 'cursor-not-allowed text-text-muted opacity-40'
            : elegido
              ? 'bg-accent font-semibold text-accent-fg shadow-xs'
              : esHoy
                ? 'border border-accent-border font-medium text-text-h hover:bg-accent-bg'
                : 'text-text hover:bg-accent-bg hover:text-text-h';

          return (
            <button
              key={iso}
              type="button"
              disabled={bloqueado}
              aria-pressed={elegido}
              aria-current={esHoy ? 'date' : undefined}
              onClick={() => onSelect(iso)}
              className={`${CELDA_CLASSES} ${estado}`}
            >
              {dia}
            </button>
          );
        })}
      </div>

      {/* El limite del mes se dice, no solo se pinta: sin esto, un mes entero deshabilitado
          parece un error de carga. */}
      {min && min > ultimoDelMes && (
        <p className="px-1 pb-1 text-xs text-text-muted">Este mes ya paso.</p>
      )}
    </div>
  );
}

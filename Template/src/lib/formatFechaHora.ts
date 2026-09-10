/**
 * Fechas **con hora**, para las citas.
 *
 * Distinto de `lib/formatFecha`, que recibe un solo-dia ("2026-08-14") y lo parte a mano
 * justamente para no pasar por `new Date`. Aqui la entrada es un ISO 8601 completo con
 * zona ("2026-09-07T14:30:00.000Z"), que es un instante sin ambiguedad: `new Date` es lo
 * correcto y lo unico que hace falta.
 *
 * **Se muestra en la zona del navegador.** El negocio tiene la suya en
 * `ConfiguracionNegocio.zonaHoraria`, pero todavia no hay endpoint publico que la sirva
 * (ver `lib/configuracionPlaceholder`). Mientras tanto, un cliente que viaja ve su hora
 * local y no la del local. Cuando exista el endpoint, se le pasa `timeZone` a estos
 * formatters y no cambia ninguna pagina.
 */

type Estilo = 'fechaHora' | 'fecha' | 'fechaLarga' | 'hora';

const OPCIONES: Record<Estilo, Intl.DateTimeFormatOptions> = {
  fechaHora: { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  fecha: { day: 'numeric', month: 'short', year: 'numeric' },
  fechaLarga: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  hora: { hour: 'numeric', minute: '2-digit' },
};

// Construir un Intl.DateTimeFormat es caro y una lista de 50 citas formatea varias fechas
// por fila. Se cachean por locale+estilo, igual que en formatPrice y formatFecha; el juego
// de combinaciones es fijo y minimo.
const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, estilo: Estilo): Intl.DateTimeFormat {
  const clave = `${locale}|${estilo}`;
  let formatter = formatters.get(clave);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, OPCIONES[estilo]);
    formatters.set(clave, formatter);
  }
  return formatter;
}

export function formatFechaHora(iso: string, locale: string): string {
  return getFormatter(locale, 'fechaHora').format(new Date(iso));
}

export function formatFechaDeISO(iso: string, locale: string): string {
  return getFormatter(locale, 'fecha').format(new Date(iso));
}

export function formatFechaLarga(iso: string, locale: string): string {
  return getFormatter(locale, 'fechaLarga').format(new Date(iso));
}

export function formatHora(iso: string, locale: string): string {
  return getFormatter(locale, 'hora').format(new Date(iso));
}

/**
 * El tramo que ocupa la cita: "8:30 – 9:15". Se pinta asi y no como dos horas sueltas
 * porque lo que el usuario reconoce de una cita es cuanto le va a tomar.
 */
export function formatRangoHoras(inicio: string, fin: string, locale: string): string {
  return `${formatHora(inicio, locale)} – ${formatHora(fin, locale)}`;
}

/**
 * El dia de un instante ISO, en `YYYY-MM-DD` y **en la zona del navegador**.
 *
 * No sirve `iso.slice(0, 10)`: eso corta el dia en UTC, y para una cita de las 8 p.m. en
 * un offset negativo devuelve el dia siguiente. Es el mismo error que `lib/fechaISO` evita
 * en la otra direccion, asi que se arma con los componentes locales.
 */
export function diaLocalDeISO(iso: string): string {
  const fecha = new Date(iso);
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Si el instante ya paso. Decide si una cita se lista como proxima o como historial. */
export function yaPaso(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

/**
 * Un `YYYY-MM-DD` de un `<input type="date">` llevado al instante ISO que espera el API.
 * `desde` toma el arranque del dia y `hasta` el arranque del **siguiente**, porque el
 * filtro del API es semiabierto: `desde` inclusive, `hasta` exclusive. Sin el dia extra,
 * pedir "hasta el 8" dejaria fuera todas las citas del 8.
 */
export function limiteDelDia(dia: string, borde: 'desde' | 'hasta'): string {
  const [anio, mes, diaDelMes] = dia.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, borde === 'hasta' ? diaDelMes + 1 : diaDelMes);
  return fecha.toISOString();
}

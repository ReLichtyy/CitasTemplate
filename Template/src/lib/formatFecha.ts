const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    formatters.set(locale, formatter);
  }
  return formatter;
}

// Fecha sin hora ("2026-08-14"). Se parte a mano en vez de `new Date(iso)`, que la
// interpreta como medianoche UTC y en zonas con offset negativo —la de este proyecto lo
// es— termina mostrando el dia anterior.
export function formatFecha(iso: string, locale: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return getFormatter(locale).format(new Date(anio, mes - 1, dia));
}

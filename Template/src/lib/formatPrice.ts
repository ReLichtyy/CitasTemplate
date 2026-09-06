// Construir un Intl.NumberFormat es caro y cada card formatea un precio en cada render,
// asi que se cachean por locale+moneda. El juego de combinaciones es minimo (una sola por
// negocio), no hay riesgo de que el Map crezca.
const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(moneda: string, locale: string): Intl.NumberFormat {
  const clave = `${locale}|${moneda}`;
  let formatter = formatters.get(clave);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: moneda });
    formatters.set(clave, formatter);
  }
  return formatter;
}

// Servicio.precio viaja como cadena (Decimal en la base). Intl.NumberFormat acepta un
// valor numerico string directamente y preserva su precision exacta; convertirlo con
// Number() primero introduce error de redondeo en importes grandes. Ver spec/07.
export function formatPrice(precio: string, moneda: string, locale: string): string {
  return getFormatter(moneda, locale).format(precio as unknown as number);
}

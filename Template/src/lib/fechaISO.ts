/**
 * Fechas sin hora, en ISO corto (`2026-08-14`), siempre en la zona del navegador.
 *
 * Nada de esto pasa por `new Date(iso)`: esa forma interpreta la cadena como medianoche
 * UTC y en offsets negativos —el de este proyecto lo es— devuelve el dia anterior. Aqui
 * se arma y se parte por numeros, que es la unica manera de que "hoy" sea hoy.
 */

export function aISO(anio: number, mes: number, dia: number): string {
  return `${anio}-${`${mes + 1}`.padStart(2, '0')}-${`${dia}`.padStart(2, '0')}`;
}

export function desdeISO(iso: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return { anio, mes: mes - 1, dia };
}

export function hoyEnISO(): string {
  const hoy = new Date();
  return aISO(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
}

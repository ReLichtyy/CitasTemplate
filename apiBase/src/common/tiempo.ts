/**
 * Aritmetica de tiempo compartida por disponibilidad y agenda.
 *
 * Dos representaciones conviven a proposito (ver 01-modelo-datos.md):
 *   - HorarioAtencion guarda minutos desde medianoche (0..1439), sin zona.
 *   - Cita y RestriccionHorario guardan instantes absolutos (DateTime).
 *
 * Traducir entre las dos exige la zona del negocio (ConfiguracionNegocio.zonaHoraria),
 * porque "las 9:00" solo significa algo dentro de una zona. Se resuelve con Intl y no
 * con una dependencia: la unica operacion que hace falta es el desplazamiento de la
 * zona en un instante dado, que Intl ya sabe calcular incluyendo horario de verano.
 */
import { DiaSemana } from '../generated/prisma/enums.js';

const MS_POR_MINUTO = 60_000;

/** getUTCDay() devuelve 0 = domingo. */
const DIAS_DE_LA_SEMANA: DiaSemana[] = [
  DiaSemana.DOMINGO,
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
];

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(zona: string): Intl.DateTimeFormat {
  let existente = formateadores.get(zona);
  if (!existente) {
    existente = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formateadores.set(zona, existente);
  }
  return existente;
}

/**
 * Diferencia en milisegundos entre la hora de pared en `zona` y UTC, en ese instante.
 * Positivo al este de Greenwich.
 */
export function desplazamientoZonaMs(instante: Date, zona: string): number {
  const partes = Object.fromEntries(
    formateador(zona)
      .formatToParts(instante)
      .filter((parte) => parte.type !== 'literal')
      .map((parte) => [parte.type, Number(parte.value)]),
  ) as Record<string, number>;

  // Algunas versiones de ICU devuelven 24 para medianoche.
  const horaPared = Date.UTC(
    partes.year,
    partes.month - 1,
    partes.day,
    partes.hour % 24,
    partes.minute,
    partes.second,
  );
  return horaPared - instante.getTime();
}

export interface PartesEnZona {
  anio: number;
  mes: number;
  dia: number;
  /** Minutos desde medianoche, la misma unidad que HorarioAtencion. */
  minutos: number;
  diaSemana: DiaSemana;
}

/** Descompone un instante absoluto en su hora de pared dentro de `zona`. */
export function partesEnZona(instante: Date, zona: string): PartesEnZona {
  // Desplazado, los campos UTC del Date coinciden con la hora de pared en la zona.
  const pared = new Date(instante.getTime() + desplazamientoZonaMs(instante, zona));
  return {
    anio: pared.getUTCFullYear(),
    mes: pared.getUTCMonth() + 1,
    dia: pared.getUTCDate(),
    minutos: pared.getUTCHours() * 60 + pared.getUTCMinutes(),
    diaSemana: DIAS_DE_LA_SEMANA[pared.getUTCDay()],
  };
}

/**
 * Inversa de `partesEnZona`: el instante absoluto de una hora de pared.
 * El segundo calculo del desplazamiento cubre los saltos de horario de verano,
 * donde el desplazamiento de la fecha supuesta no es el de la fecha real.
 */
export function instanteDesdeZona(
  anio: number,
  mes: number,
  dia: number,
  minutos: number,
  zona: string,
): Date {
  const supuesto = Date.UTC(anio, mes - 1, dia, Math.floor(minutos / 60), minutos % 60);
  const primero = desplazamientoZonaMs(new Date(supuesto), zona);
  const segundo = desplazamientoZonaMs(new Date(supuesto - primero), zona);
  return new Date(supuesto - segundo);
}

/**
 * Traslape de dos intervalos semiabiertos [inicio, fin).
 * Los extremos que se tocan no traslapan: una cita que termina 10:00 y otra que
 * empieza 10:00 conviven. Ver 02-reservas-concurrencia.md.
 */
export function seTraslapan(
  inicioA: Date,
  finA: Date,
  inicioB: Date,
  finB: Date,
): boolean {
  return inicioA.getTime() < finB.getTime() && inicioB.getTime() < finA.getTime();
}

export function sumarMinutos(instante: Date, minutos: number): Date {
  return new Date(instante.getTime() + minutos * MS_POR_MINUTO);
}

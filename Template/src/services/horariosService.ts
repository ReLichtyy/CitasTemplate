import { apiClient } from '../api/client';

/**
 * Los mismos valores del enum `DiaSemana` del API, en el orden en que se lee una semana.
 * Se declaran aqui y no en cada pantalla porque la lista, el formulario y la ficha
 * necesitan **el mismo** orden; si cada una lo declara, terminan mostrando semanas distintas.
 */
export const DIAS_SEMANA = [
  { valor: 'LUNES', etiqueta: 'Lunes' },
  { valor: 'MARTES', etiqueta: 'Martes' },
  { valor: 'MIERCOLES', etiqueta: 'Miercoles' },
  { valor: 'JUEVES', etiqueta: 'Jueves' },
  { valor: 'VIERNES', etiqueta: 'Viernes' },
  { valor: 'SABADO', etiqueta: 'Sabado' },
  { valor: 'DOMINGO', etiqueta: 'Domingo' },
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number]['valor'];

/** Etiqueta legible de un dia, para las filas y la ficha. */
export function etiquetaDia(dia: string): string {
  return DIAS_SEMANA.find((d) => d.valor === dia)?.etiqueta ?? dia;
}

/** Una franja de atencion. Los extremos son minutos desde medianoche, igual que en la base. */
export type HorarioGestion = {
  id: string;
  dia: DiaSemana;
  minutoApertura: number;
  minutoCierre: number;
  /** Apagado = ese rango no atiende, sin borrarlo. */
  activo: boolean;
};

export type CrearHorarioPayload = {
  dia: DiaSemana;
  minutoApertura: number;
  minutoCierre: number;
  activo?: boolean;
};

export type ActualizarHorarioPayload = Partial<CrearHorarioPayload>;

export const horariosService = {
  list: () => apiClient.get<HorarioGestion[]>('/horarios'),
  get: (id: string) => apiClient.get<HorarioGestion>(`/horarios/${id}`),
  crear: (dto: CrearHorarioPayload) => apiClient.post<HorarioGestion>('/horarios', dto),
  actualizar: (id: string, dto: ActualizarHorarioPayload) =>
    apiClient.patch<HorarioGestion>(`/horarios/${id}`, dto),
  /**
   * Si borra la fila: una franja no queda citada en ningun historico. La vuelta atras es
   * volver a crearla, y `despublicar` (apagar `activo`) sigue existiendo para pausar un dia
   * sin perder el rango.
   */
  eliminar: (id: string) => apiClient.delete<HorarioGestion>(`/horarios/${id}`),
};

/** 540 -> "09:00". Para pintar la franja tal como se lee en una agenda. */
export function aHoraPared(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${`${horas}`.padStart(2, '0')}:${`${resto}`.padStart(2, '0')}`;
}

/** "09:00" -> 540. La inversa, para mandar al API lo que el `<input type="time">` dio. */
export function aMinutos(horaPared: string): number {
  const [horas, minutos] = horaPared.split(':').map(Number);
  return (horas ?? 0) * 60 + (minutos ?? 0);
}

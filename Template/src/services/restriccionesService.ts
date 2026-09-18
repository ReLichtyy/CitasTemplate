import { apiClient } from '../api/client';

/** Los mismos valores del enum `TipoRestriccion` del API, con su etiqueta legible. */
export const TIPOS_RESTRICCION = [
  { valor: 'FERIADO', etiqueta: 'Feriado' },
  { valor: 'VACACIONES', etiqueta: 'Vacaciones' },
  { valor: 'BLOQUEO', etiqueta: 'Bloqueo' },
] as const;

export type TipoRestriccion = (typeof TIPOS_RESTRICCION)[number]['valor'];

/** Etiqueta legible de un tipo, para las filas y la ficha. */
export function etiquetaTipo(tipo: string): string {
  return TIPOS_RESTRICCION.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

/**
 * Un bloqueo puntual. `empleadoId` nulo = aplica a todo el negocio; el nombre de quien
 * bloquea llega resuelto para que la fila se lea sin abrir nada.
 */
export type RestriccionGestion = {
  id: string;
  tipo: TipoRestriccion;
  empleadoId: string | null;
  empleado: { id: string; usuario: { nombre: string; apellido: string | null } } | null;
  /** Instantes ISO 8601 completos, no horas de pared: el API los resuelve en su zona. */
  inicio: string;
  fin: string;
  motivo: string | null;
};

export type CrearRestriccionPayload = {
  tipo: TipoRestriccion;
  empleadoId?: string;
  inicio: string;
  fin: string;
  motivo?: string;
};

export type ActualizarRestriccionPayload = Partial<CrearRestriccionPayload>;

export const restriccionesService = {
  list: () => apiClient.get<RestriccionGestion[]>('/restricciones'),
  get: (id: string) => apiClient.get<RestriccionGestion>(`/restricciones/${id}`),
  crear: (dto: CrearRestriccionPayload) =>
    apiClient.post<RestriccionGestion>('/restricciones', dto),
  actualizar: (id: string, dto: ActualizarRestriccionPayload) =>
    apiClient.patch<RestriccionGestion>(`/restricciones/${id}`, dto),
  /** Si borra la fila: un bloqueo vencido no cuelga de ningun historico. */
  eliminar: (id: string) => apiClient.delete<RestriccionGestion>(`/restricciones/${id}`),
};

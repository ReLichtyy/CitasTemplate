import { apiClient } from '../api/client';

export type SlotDisponible = { inicio: string; fin: string };

export type Disponibilidad = {
  fecha: string;
  zonaHoraria: string;
  duracionMinutos: number;
  slots: SlotDisponible[];
};

/** Datos de quien reserva sin sesion. El telefono es su identidad. */
export type DatosCliente = {
  telefono: string;
  nombre: string;
  apellido?: string;
  email?: string;
};

export type ReservarPayload = {
  servicioId: string;
  empleadoId: string;
  inicio: string;
  adicionalIds?: string[];
  /** Solo cuando no hay sesion; con sesion el cliente sale del token. */
  cliente?: DatosCliente;
  notas?: string;
};

export type CitaReservada = {
  id: string;
  inicio: string;
  fin: string;
  costoTotal: string;
  estado: { codigo: string; nombre: string };
  servicio: { id: string; nombre: string };
  empleado: { id: string; usuario: { nombre: string; apellido: string | null } };
};

export const citasService = {
  list: () => apiClient.get('/citas'),
  get: (id: string) => apiClient.get(`/citas/${id}`),
  // La disponibilidad la calcula el servidor: aqui no se simula ni se adivina.
  disponibilidad: (params: { empleadoId: string; servicioId: string; fecha: string }) =>
    apiClient.get<Disponibilidad>(`/citas/disponibilidad?${new URLSearchParams(params)}`),
  reservar: (dto: ReservarPayload) => apiClient.post<CitaReservada>('/citas', dto),
  update: (id: string, dto: unknown) => apiClient.patch(`/citas/${id}`, dto),
  cancelar: (id: string) => apiClient.delete(`/citas/${id}`),
};

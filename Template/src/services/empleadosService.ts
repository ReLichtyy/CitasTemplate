import { apiClient } from '../api/client';

/** Servicio tal como lo trae la ficha publica de un empleado: lo que esa persona hace. */
export type ServicioDeEmpleado = {
  id: string;
  nombre: string;
  duracionMinutos: number;
  /** `Decimal` de Prisma: llega como cadena y se formatea con `Intl`. */
  precio: string;
};

/**
 * Del `Usuario` detras del empleado solo llega el nombre: el telefono es la credencial
 * de acceso y no es catalogo publico.
 */
export type EmpleadoPublico = {
  id: string;
  bio: string | null;
  fotoUrl: string | null;
  usuario: { nombre: string; apellido: string | null };
  especialidad: { id: string; nombre: string } | null;
  servicios: ServicioDeEmpleado[];
};

export const empleadosService = {
  list: () => apiClient.get<EmpleadoPublico[]>('/empleados'),
  get: (id: string) => apiClient.get<EmpleadoPublico>(`/empleados/${id}`),
  create: (dto: unknown) => apiClient.post('/empleados', dto),
  update: (id: string, dto: unknown) => apiClient.patch(`/empleados/${id}`, dto),
  remove: (id: string) => apiClient.delete(`/empleados/${id}`),
};

import { apiClient } from '../api/client';

export type EmpleadoDeServicio = {
  id: string;
  fotoUrl: string | null;
  usuario: { nombre: string; apellido: string | null };
};

export type ServicioPublico = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracionMinutos: number;
  /**
   * Un `Decimal` de Prisma se serializa como cadena, no como numero. Se formatea con
   * `Intl`; el importe que vale lo decide el API, aqui no se opera con el.
   */
  precio: string;
  imagenUrl: string | null;
  empleados: EmpleadoDeServicio[];
};

export const serviciosService = {
  list: () => apiClient.get<ServicioPublico[]>('/servicios'),
  get: (id: string) => apiClient.get<ServicioPublico>(`/servicios/${id}`),
  create: (dto: unknown) => apiClient.post('/servicios', dto),
  update: (id: string, dto: unknown) => apiClient.patch(`/servicios/${id}`, dto),
  remove: (id: string) => apiClient.delete(`/servicios/${id}`),
};

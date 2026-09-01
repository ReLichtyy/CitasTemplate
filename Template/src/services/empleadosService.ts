import { apiClient } from '../api/client';

export const empleadosService = {
  list: () => apiClient.get('/empleados'),
  get: (id: string) => apiClient.get(`/empleados/${id}`),
  create: (dto: unknown) => apiClient.post('/empleados', dto),
  update: (id: string, dto: unknown) => apiClient.patch(`/empleados/${id}`, dto),
  remove: (id: string) => apiClient.delete(`/empleados/${id}`),
};

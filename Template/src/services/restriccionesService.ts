import { apiClient } from '../api/client';

export const restriccionesService = {
  list: () => apiClient.get('/restricciones'),
  get: (id: string) => apiClient.get(`/restricciones/${id}`),
  create: (dto: unknown) => apiClient.post('/restricciones', dto),
  update: (id: string, dto: unknown) => apiClient.patch(`/restricciones/${id}`, dto),
  remove: (id: string) => apiClient.delete(`/restricciones/${id}`),
};

import { apiClient } from '../api/client';

export const serviciosService = {
  list: () => apiClient.get('/servicios'),
  get: (id: string) => apiClient.get(`/servicios/${id}`),
  create: (dto: unknown) => apiClient.post('/servicios', dto),
  update: (id: string, dto: unknown) => apiClient.patch(`/servicios/${id}`, dto),
  remove: (id: string) => apiClient.delete(`/servicios/${id}`),
};

import { apiClient } from '../api/client';

export const adicionalesService = {
  list: () => apiClient.get('/adicionales'),
  get: (id: string) => apiClient.get(`/adicionales/${id}`),
  create: (dto: unknown) => apiClient.post('/adicionales', dto),
  update: (id: string, dto: unknown) => apiClient.patch(`/adicionales/${id}`, dto),
  remove: (id: string) => apiClient.delete(`/adicionales/${id}`),
};

import { apiClient } from '../api/client';

export const citasService = {
  list: () => apiClient.get('/citas'),
  get: (id: string) => apiClient.get(`/citas/${id}`),
  reservar: (dto: unknown) => apiClient.post('/citas', dto),
  update: (id: string, dto: unknown) => apiClient.patch(`/citas/${id}`, dto),
  cancelar: (id: string) => apiClient.delete(`/citas/${id}`),
};

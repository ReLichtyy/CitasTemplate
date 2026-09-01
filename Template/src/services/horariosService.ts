import { apiClient } from '../api/client';

export const horariosService = {
  list: () => apiClient.get('/horarios'),
  get: (id: string) => apiClient.get(`/horarios/${id}`),
  create: (dto: unknown) => apiClient.post('/horarios', dto),
  update: (id: string, dto: unknown) => apiClient.patch(`/horarios/${id}`, dto),
  remove: (id: string) => apiClient.delete(`/horarios/${id}`),
};

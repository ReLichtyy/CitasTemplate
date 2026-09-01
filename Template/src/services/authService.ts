import { apiClient } from '../api/client';

export type Role = 'admin' | 'empleado' | 'cliente';

export type LoginPayload = { email: string; password: string };
export type LoginResponse = { accessToken: string };

export const authService = {
  login: (payload: LoginPayload) => apiClient.post<LoginResponse>('/auth/login', payload),
};

import { apiClient } from '../api/client';

export type Role = 'admin' | 'empleado' | 'cliente';

export type LoginPayload = { email: string; password: string };
export type LoginResponse = { accessToken: string };

/** Datos propios de quien tiene sesion. Nunca incluye la contrasena. */
export type UsuarioActual = {
  id: string;
  telefono: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
};

export const authService = {
  login: (payload: LoginPayload) => apiClient.post<LoginResponse>('/auth/login', payload),
  me: () => apiClient.get<UsuarioActual>('/auth/me'),
};

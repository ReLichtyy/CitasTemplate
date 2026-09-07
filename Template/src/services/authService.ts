import { apiClient } from '../api/client';

/**
 * Mayusculas porque el enum `Rol` de Prisma es la fuente: comparar 'ADMIN' contra
 * 'admin' dejaba toda ruta con `@Roles(...)` en 403. Ver 03-autorizacion.md.
 */
export type Rol = 'ADMIN' | 'EMPLEADO' | 'CLIENTE';

/** El telefono es la credencial, no el correo (decision cerrada en SPEC.md). */
export type LoginPayload = { telefono: string; password: string };

export type RegistroPayload = {
  telefono: string;
  password: string;
  nombre: string;
  apellido?: string;
  email?: string;
};

/** Datos propios de quien tiene sesion. Nunca incluye la contrasena. */
export type UsuarioActual = {
  id: string;
  telefono: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  rol: Rol;
};

/**
 * Login y registro devuelven lo mismo: el token y la ficha.
 *
 * La ficha viaja aqui para que el frontend no tenga que decodificar el JWT ni encadenar
 * un `GET /auth/me` solo para saber que rol pintar en el navbar. No es autorizacion —
 * esa la sigue decidiendo el servidor en cada peticion.
 */
export type Sesion = { accessToken: string; usuario: UsuarioActual };

/** Lo unico editable del perfil. El telefono es identidad: cambiarlo es soporte manual. */
export type PerfilPayload = { nombre: string; apellido?: string; email?: string };

export const authService = {
  login: (payload: LoginPayload) => apiClient.post<Sesion>('/auth/login', payload),
  registro: (payload: RegistroPayload) => apiClient.post<Sesion>('/auth/registro', payload),
  me: () => apiClient.get<UsuarioActual>('/auth/me'),
  actualizarPerfil: (payload: PerfilPayload) => apiClient.patch<UsuarioActual>('/auth/me', payload),
};

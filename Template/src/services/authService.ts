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
export type Sesion = {
  accessToken: string;
  /**
   * Cuando vence el token, en ISO 8601. Lo calcula el servidor desde el `exp` que el
   * propio token lleva firmado.
   *
   * **No es autorizacion**: el servidor revalida la firma y su `exp` en cada peticion, y
   * adelantar el reloj del navegador no alarga nada. Sirve para cerrar la sesion **a
   * tiempo** en vez de descubrir que murio en el primer 401, que suele caer a mitad de un
   * formulario ya lleno.
   */
  expiraEn: string;
  usuario: UsuarioActual;
};

/** Cuerpo de `POST /auth/password`. La actual es lo que autoriza el cambio. */
export type CambioPasswordPayload = { actual: string; nueva: string };

/** Lo unico editable del perfil. El telefono es identidad: cambiarlo es soporte manual. */
export type PerfilPayload = { nombre: string; apellido?: string; email?: string };

export const authService = {
  login: (payload: LoginPayload) => apiClient.post<Sesion>('/auth/login', payload),
  registro: (payload: RegistroPayload) => apiClient.post<Sesion>('/auth/registro', payload),
  me: () => apiClient.get<UsuarioActual>('/auth/me'),
  actualizarPerfil: (payload: PerfilPayload) => apiClient.patch<UsuarioActual>('/auth/me', payload),
  /**
   * Cambia la propia contrasena. Devuelve 204 sin cuerpo: **no** entrega un token nuevo,
   * porque eso daria a entender que los viejos dejaron de valer y no es cierto — las
   * demas sesiones siguen vivas hasta que sus tokens vencen.
   */
  cambiarPassword: (payload: CambioPasswordPayload) =>
    apiClient.post<void>('/auth/password', payload),
};

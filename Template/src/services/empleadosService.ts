import { apiClient } from '../api/client';
import type { Rating } from '../types/catalogo';

/** Servicio tal como lo trae la ficha publica de un empleado: lo que esa persona hace. */
export type ServicioDeEmpleado = {
  id: string;
  nombre: string;
  duracionMinutos: number;
  /** `Decimal` de Prisma: llega como cadena y se formatea con `Intl`. */
  precio: string;
};

/**
 * Del `Usuario` detras del empleado solo llega el nombre: el telefono es la credencial
 * de acceso y no es catalogo publico.
 */
export type EmpleadoPublico = {
  id: string;
  bio: string | null;
  fotoUrl: string | null;
  usuario: { nombre: string; apellido: string | null };
  especialidad: { id: string; nombre: string } | null;
  servicios: ServicioDeEmpleado[];
  /**
   * Nulo mientras no tenga resenas publicadas. El API ya devuelve el promedio y las tres
   * ultimas calculados: aqui no se suma nada.
   */
  rating: Rating | null;
};

export const empleadosService = {
  list: () => apiClient.get<EmpleadoPublico[]>('/empleados'),
  get: (id: string) => apiClient.get<EmpleadoPublico>(`/empleados/${id}`),
  /**
   * Todo el equipo, dado de baja incluido, con telefono y asignacion completa. Es una ruta
   * aparte y no la publica con un parametro — la gestion no puede recibir de menos.
   */
  listarGestion: () => apiClient.get<EmpleadoGestion[]>('/empleados/gestion'),
  crear: (dto: CrearEmpleadoPayload) => apiClient.post<EmpleadoGestion>('/empleados', dto),
  actualizar: (id: string, dto: ActualizarEmpleadoPayload) =>
    apiClient.patch<EmpleadoGestion>(`/empleados/${id}`, dto),
  /**
   * **Da de baja la ficha y el acceso, no borra.** El empleado sigue colgando del
   * historial de cada cita que atendio. Desde el formulario se reactiva.
   */
  darBaja: (id: string) => apiClient.delete<EmpleadoGestion>(`/empleados/${id}`),
};

/**
 * La ficha completa para gestion: el telefono viaja aqui (a diferencia del catalogo
 * publico) porque quien administra tiene que poder llamar a su personal, y la lista de
 * servicios es la asignacion completa, tambien los desactivados.
 */
export type EmpleadoGestion = {
  id: string;
  bio: string | null;
  fotoUrl: string | null;
  /** La ficha laboral completa: catalogo publico y acceso. Ver ActualizarEmpleadoPayload. */
  activo: boolean;
  usuario: {
    telefono: string;
    nombre: string;
    apellido: string | null;
    email: string | null;
  };
  especialidad: { id: string; nombre: string } | null;
  servicios: { id: string; nombre: string }[];
};

/**
 * Cuerpo de alta: la ficha laboral y su cuenta, que nacen juntas. La contrasena es
 * opcional — sin ella, el propio empleado la reclama registrandose con su telefono y
 * conserva el rol.
 */
export type CrearEmpleadoPayload = {
  telefono: string;
  nombre: string;
  apellido?: string;
  password?: string;
  email?: string;
  bio?: string;
  fotoUrl?: string;
  especialidadId?: string;
  /** La asignacion completa: al editar reemplaza la anterior. */
  servicioIds?: string[];
};

export type ActualizarEmpleadoPayload = Partial<CrearEmpleadoPayload> & {
  /** La ficha laboral completa: apagar lo saca del catalogo **y** corta el acceso. */
  activo?: boolean;
};

import { apiClient } from '../api/client';

export type EmpleadoDeServicio = {
  id: string;
  fotoUrl: string | null;
  usuario: { nombre: string; apellido: string | null };
};

export type ServicioPublico = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracionMinutos: number;
  /**
   * Un `Decimal` de Prisma se serializa como cadena, no como numero. Se formatea con
   * `Intl`; el importe que vale lo decide el API, aqui no se opera con el.
   */
  precio: string;
  imagenUrl: string | null;
  empleados: EmpleadoDeServicio[];
};

/**
 * La asignacion tal como la ve la gestion: **todos** los profesionales, tambien los dados
 * de baja, con su indicador. La publico filtra los inactivos; la gestion no puede — es la
 * que decide si cambia la asignacion.
 */
export type EmpleadoDeServicioGestion = {
  id: string;
  fotoUrl: string | null;
  activo: boolean;
  usuario: { nombre: string; apellido: string | null };
};

/** El servicio completo para gestion, publicado o no. */
export type ServicioGestion = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracionMinutos: number;
  precio: string;
  imagenUrl: string | null;
  /** Publicado en el catalogo publico. */
  activo: boolean;
  empleados: EmpleadoDeServicioGestion[];
};

/**
 * Cuerpo de alta. El precio viaja como cadena con hasta dos decimales, igual que en
 * productos. `empleadoIds` es la asignacion **completa**: al editar reemplaza la anterior.
 */
export type CrearServicioPayload = {
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
  precio: string;
  imagenUrl?: string;
  activo?: boolean;
  empleadoIds?: string[];
};

export type ActualizarServicioPayload = Partial<CrearServicioPayload>;

export const serviciosService = {
  list: () => apiClient.get<ServicioPublico[]>('/servicios'),
  get: (id: string) => apiClient.get<ServicioPublico>(`/servicios/${id}`),
  /**
   * Todo el catalogo, publicado o no, con la asignacion completa. Es una ruta aparte y no
   * la publica con un parametro: asi ninguna peticion del catalogo puede devolver de mas
   * por descuido.
   */
  listarGestion: () => apiClient.get<ServicioGestion[]>('/servicios/gestion'),
  crear: (dto: CrearServicioPayload) => apiClient.post<ServicioGestion>('/servicios', dto),
  actualizar: (id: string, dto: ActualizarServicioPayload) =>
    apiClient.patch<ServicioGestion>(`/servicios/${id}`, dto),
  /**
   * **Desactiva, no borra.** El servicio sigue citado en el historial de cada cita que lo
   * reservo; desde el formulario se vuelve a publicar.
   */
  despublicar: (id: string) => apiClient.delete<ServicioGestion>(`/servicios/${id}`),
};

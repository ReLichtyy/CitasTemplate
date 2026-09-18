import { apiClient } from '../api/client';

/**
 * Las especialidades del equipo. Solo lectura: las altas todavia no existen como pantalla,
 * esta lista es la que elige el formulario de un empleado.
 */
export type Especialidad = {
  id: string;
  nombre: string;
  descripcion: string | null;
};

export const especialidadesService = {
  list: () => apiClient.get<Especialidad[]>('/especialidades'),
};

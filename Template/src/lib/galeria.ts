import type { EmpleadoPublico } from '../services/empleadosService';
import type { ServicioPublico } from '../services/serviciosService';
import { nombreCompleto } from './especialista';

export type ItemGaleria = {
  id: string;
  imagenUrl: string;
  titulo: string;
  subtitulo: string;
  to: string;
};

/**
 * Fotos reales del catalogo de servicios y de las fichas del equipo, aplanadas a la forma
 * que consume una rejilla de galeria. Vive aparte de `GaleriaPage` porque el teaser de la
 * landing arma la misma lista y solo se queda con los primeros items.
 */
export function construirGaleria(
  servicios: ServicioPublico[],
  empleados: EmpleadoPublico[],
  terminoServicioPlural: string,
  terminoEmpleadoPlural: string,
): ItemGaleria[] {
  const itemsServicios: ItemGaleria[] = servicios
    .filter((s) => !!s.imagenUrl)
    .map((s) => ({
      id: `servicio-${s.id}`,
      imagenUrl: s.imagenUrl as string,
      titulo: s.nombre,
      subtitulo: terminoServicioPlural,
      to: '/servicios',
    }));

  const itemsEquipo: ItemGaleria[] = empleados
    .filter((e) => !!e.fotoUrl)
    .map((e) => ({
      id: `empleado-${e.id}`,
      imagenUrl: e.fotoUrl as string,
      titulo: nombreCompleto(e.usuario.nombre, e.usuario.apellido),
      subtitulo: e.especialidad?.nombre ?? terminoEmpleadoPlural,
      to: '/equipo',
    }));

  return [...itemsServicios, ...itemsEquipo];
}

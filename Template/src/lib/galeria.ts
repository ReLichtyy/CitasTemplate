import type { FotoGaleria } from '../services/galeriaService';
import type { EmpleadoPublico } from '../services/empleadosService';
import type { ServicioPublico } from '../services/serviciosService';
import { nombreCompleto } from './especialista';

export type ItemGaleria = {
  id: string;
  imagenUrl: string;
  titulo: string;
  subtitulo: string;
  to: string;
  /**
   * Solo en las fotos de resultado: el id de la fila de `FotoGaleria` — sin el prefijo
   * del `id` de la rejilla — que es el que pide `DELETE /galeria/:id`. Las fotos del
   * catalogo no lo llevan: no son de este dominio y no se administran desde la galeria.
   */
  fotoId?: string;
};

/**
 * Fotos reales del negocio, aplanadas a la forma que consume una rejilla de galeria: las
 * del catalogo de servicios, las fotos de resultado que agrega el personal y las de las
 * fichas del equipo. Vive aparte de `GaleriaPage` porque el teaser de la landing arma la
 * misma lista y solo se queda con los primeros items.
 */
export function construirGaleria(
  servicios: ServicioPublico[],
  fotos: FotoGaleria[],
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
      // El catalogo vive en la seccion `#servicios` de `/equipo`, no en una pagina propia.
      to: '/equipo#servicios',
    }));

  // La foto de resultado existe para contestar "con que servicio se logro esto": el
  // nombre del servicio siempre sale — de subtitulo cuando hay pie de foto, de titulo
  // cuando no — porque una foto sin pie no puede quedarse sin decir a que servicio
  // pertenece.
  const itemsFotos: ItemGaleria[] = fotos.map((f) => ({
    id: `foto-${f.id}`,
    fotoId: f.id,
    imagenUrl: f.imagenUrl,
    titulo: f.descripcion ?? f.servicio.nombre,
    subtitulo: f.descripcion ? f.servicio.nombre : terminoServicioPlural,
    // La foto contesta "con que servicio se logro esto": lleva a la seccion del
    // catalogo, no a la ficha del servicio.
    to: '/equipo#servicios',
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

  return [...itemsServicios, ...itemsFotos, ...itemsEquipo];
}

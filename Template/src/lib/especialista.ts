import type { EmpleadoPublico } from '../services/empleadosService';
import type { Especialista } from '../types/catalogo';

// Derivaciones del nombre de un especialista. Viven aparte de la card porque el modal de
// detalle (y manana la pagina /equipo/:id) tienen que mostrar exactamente lo mismo.
export function iniciales(nombre: string, apellido?: string | null): string {
  return `${nombre.trim().charAt(0)}${apellido?.trim().charAt(0) ?? ''}`.toUpperCase();
}

export function nombreCompleto(nombre: string, apellido?: string | null): string {
  return apellido ? `${nombre} ${apellido}` : nombre;
}

/**
 * Aplana la ficha del API a la forma que consumen las cards.
 *
 * El API no traduce nombres entre capas —el empleado tiene un `usuario` y una
 * `especialidad`, y asi llegan—, mientras que la card quiere un objeto plano. Esa
 * diferencia se resuelve una vez aqui y no en cada pagina que muestre un especialista.
 */
export function aEspecialista(empleado: EmpleadoPublico): Especialista {
  return {
    id: empleado.id,
    nombre: empleado.usuario.nombre,
    apellido: empleado.usuario.apellido,
    especialidad: empleado.especialidad?.nombre ?? null,
    fotoUrl: empleado.fotoUrl,
    bio: empleado.bio,
    rating: empleado.rating,
  };
}

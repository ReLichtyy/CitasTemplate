// Derivaciones del nombre de un especialista. Viven aparte de la card porque el modal de
// detalle (y manana la pagina /equipo/:id) tienen que mostrar exactamente lo mismo.
export function iniciales(nombre: string, apellido?: string | null): string {
  return `${nombre.trim().charAt(0)}${apellido?.trim().charAt(0) ?? ''}`.toUpperCase();
}

export function nombreCompleto(nombre: string, apellido?: string | null): string {
  return apellido ? `${nombre} ${apellido}` : nombre;
}

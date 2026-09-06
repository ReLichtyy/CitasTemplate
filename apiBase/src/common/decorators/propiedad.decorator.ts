import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum.js';

export const PROPIEDAD_KEY = 'propiedad';

export interface OpcionesPropiedad {
  /** Roles que pasan sin comprobar de quien es el recurso. */
  rolesLibres: Role[];
  /** Parametro de ruta que lleva el id del recurso. */
  param: string;
}

/**
 * Declara que la ruta exige propiedad, no solo rol. Hermano de `@Roles(...)`:
 * aquel responde "de que tipo es este usuario", este responde "es suya esta cita".
 * Sin el decorador, `PropiedadCitaGuard` no hace nada. Ver 03-autorizacion.md.
 */
export const PropiedadCita = (opciones: Partial<OpcionesPropiedad> = {}) =>
  SetMetadata<string, OpcionesPropiedad>(PROPIEDAD_KEY, {
    rolesLibres: [Role.ADMIN],
    param: 'id',
    ...opciones,
  });

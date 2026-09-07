import { Role } from '../common/enums/role.enum.js';

/**
 * Lo que va firmado en el token, y nada mas. `sub` se queda con su nombre porque es la
 * claim estandar de JWT; el resto usa los nombres del modelo de datos.
 *
 * El telefono es la credencial (SPEC.md), asi que es lo que identifica al portador en
 * los logs sin tener que volver a consultar la base.
 */
export interface JwtPayload {
  sub: string;
  telefono: string;
  rol: Role;
}

/** Lo que los guards y `@CurrentUser()` ven: el payload ya validado. */
export interface AuthenticatedUser {
  userId: string;
  telefono: string;
  rol: Role;
}

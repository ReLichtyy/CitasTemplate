/**
 * Los valores son los del enum `Rol` de Prisma, en mayusculas. No se traducen entre
 * capas: si aqui dijera 'admin', `RolesGuard` compararia contra el 'ADMIN' que sale de
 * la base y toda ruta con `@Roles(...)` responderia 403. Ver 03-autorizacion.md.
 */
export enum Role {
  ADMIN = 'ADMIN',
  EMPLEADO = 'EMPLEADO',
  CLIENTE = 'CLIENTE',
}

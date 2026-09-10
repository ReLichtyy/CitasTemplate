import type { Rol } from '../services/authService';
import type { Cita } from '../types/cita';

/**
 * Que puede hacer este rol con esta cita.
 *
 * Todo lo de aqui es **presentacion**: decide que boton se pinta, nunca si la operacion
 * procede. Eso lo vuelve a decidir el servidor en cada peticion —`PropiedadCitaGuard`,
 * `RolesGuard` y la relectura del estado dentro de la transaccion—, y por eso una pagina
 * que se equivoque aqui produce un 403 o un 409, no una cita cancelada de mas.
 *
 * Lo que **no** se hace: escribir la regla. Ninguna funcion dice "una CONFIRMADA no la
 * cancela el cliente"; se lee `estado.permiteCancelacionCliente`, que viaja en cada cita
 * justamente para eso. Cambiar la politica es editar la fila de `EstadoCita` en la base,
 * y ni esta capa ni las paginas se enteran. Ver `01-modelo-datos.md`.
 */

/** ADMIN y EMPLEADO son "el negocio"; CLIENTE es quien recibe el servicio. */
export function esPersonal(rol: Rol | null): boolean {
  return rol === 'ADMIN' || rol === 'EMPLEADO';
}

/**
 * Los dos indicadores de cancelacion estan separados a proposito: una cita Confirmada no
 * la cancela el cliente, pero el personal si. Con uno solo, una Confirmada no la cancelaba
 * nadie —ni el administrador— que es la deuda ESC-03 que arrastraba el sistema anterior.
 */
export function puedeCancelar(cita: Cita, rol: Rol | null): boolean {
  return esPersonal(rol)
    ? cita.estado.permiteCancelacionPersonal
    : cita.estado.permiteCancelacionCliente;
}

/**
 * Reprogramar o cambiar de estado.
 *
 * Dos condiciones, y las dos vienen del servidor: `PATCH /citas/:id` es
 * `@Roles(ADMIN, EMPLEADO)`, asi que un CLIENTE recibe 403 aunque la cita sea suya; y el
 * estado tiene que admitir edicion (una Atendida ya no se mueve). Pintarle el boton a un
 * cliente seria ofrecerle un 403.
 */
export function puedeEditar(cita: Cita, rol: Rol | null): boolean {
  return esPersonal(rol) && cita.estado.permiteEdicion;
}

/**
 * Por que no se puede cancelar, dicho como lo diria el negocio. Se usa para explicar la
 * ausencia del boton en la ficha; en la lista no se explica nada, solo se omite.
 *
 * El texto se arma con `estado.nombre`, que lo redacta el catalogo, para que no haya dos
 * lugares donde traducir un estado.
 */
export function motivoSinCancelar(cita: Cita, rol: Rol | null): string | null {
  if (puedeCancelar(cita, rol)) {
    return null;
  }
  if (cita.estado.esFinal) {
    return `Esta cita ya esta ${cita.estado.nombre.toLowerCase()}.`;
  }
  return esPersonal(rol)
    ? `Una cita ${cita.estado.nombre.toLowerCase()} ya no se puede cancelar.`
    : `Una cita ${cita.estado.nombre.toLowerCase()} ya no la puede cancelar usted; comuniquese con el negocio.`;
}

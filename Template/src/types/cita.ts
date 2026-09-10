// Formas de una cita tal como las devuelve el API. Salen de `INCLUIR_CITA` en
// `apiBase/src/citas/citas.service.ts`, que es la unica proyeccion que usan `GET /citas`,
// `GET /citas/:id`, `PATCH /citas/:id` y `DELETE /citas/:id`: las cuatro rutas devuelven
// exactamente esto, asi que hay un solo tipo y no cuatro.
//
// Dos convenciones que se repiten y conviene no volver a deducir:
// - Un `Decimal` de Prisma viaja como **cadena** ("30", "24.50"). No se convierte a
//   `number`: se formatea con `lib/formatPrice`, que preserva la precision exacta.
// - Un `DateTime` viaja como ISO 8601 completo con zona ("2026-09-07T14:30:00.000Z"),
//   a diferencia de las fechas solo-dia del catalogo. Ver `lib/formatFechaHora`.

/** Del usuario detras de una cita solo sale la proyeccion publica: nunca `password`. */
export type UsuarioResumen = {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string;
  email: string | null;
};

/**
 * El catalogo de estados, con sus indicadores. **Esto es lo que decide que botones se
 * pintan**, y por eso viaja entero en cada cita en vez de resumirse a un codigo.
 *
 * La regla de `SPEC.md` es que el navegador nunca es la autoridad. Aqui se cumple de la
 * forma barata: la UI no sabe que "una CONFIRMADA no la cancela el cliente", solo lee
 * `permiteCancelacionCliente`. Cambiar la regla es editar la fila de `EstadoCita`, no
 * el frontend, y el servidor la revalida igual cuando llega la peticion.
 */
export type EstadoCita = {
  id: string;
  /** Llave estable del catalogo (`PENDIENTE`, `CONFIRMADA`, ...). */
  codigo: string;
  /** Como se escribe para el usuario. Es lo que se pinta, no el codigo. */
  nombre: string;
  bloqueaDisponibilidad: boolean;
  permiteEdicion: boolean;
  /** Separado del de personal a proposito: una Confirmada la cancela el negocio, no el cliente. */
  permiteCancelacionCliente: boolean;
  permiteCancelacionPersonal: boolean;
  /** No hay transicion posible desde aqui. */
  esFinal: boolean;
  orden: number;
};

export type ServicioDeCita = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracionMinutos: number;
  precio: string;
  imagenUrl: string | null;
  activo: boolean;
};

export type EmpleadoDeCita = {
  id: string;
  usuarioId: string;
  especialidadId: string | null;
  bio: string | null;
  fotoUrl: string | null;
  activo: boolean;
  usuario: UsuarioResumen;
};

/**
 * Un adicional contratado. El `precio` es el del join, no el del catalogo: se congela al
 * reservar para que subir la tarifa no reescriba lo que ya se cobro.
 */
export type AdicionalDeCita = {
  citaId: string;
  adicionalId: string;
  precio: string;
  adicional: {
    id: string;
    nombre: string;
    descripcion: string | null;
    precio: string;
    activo: boolean;
  };
};

export type Cita = {
  id: string;
  clienteId: string;
  registradaPorId: string;
  empleadoId: string;
  servicioId: string;
  estadoId: string;
  /** ISO 8601 con zona. */
  inicio: string;
  fin: string;
  /**
   * El espacio que la cita ocupa en la agenda del empleado, o `null` si ya no ocupa
   * ninguno (cancelada, atendida). Es el invariante de `02-reservas-concurrencia.md`;
   * la UI no lo edita, solo lo lee si necesita explicar por que un hueco esta libre.
   */
  slotOcupado: string | null;
  precioServicio: string;
  costoAdicionales: string;
  costoTotal: string;
  motivoCancelacion: string | null;
  notas: string | null;
  creadaEn: string;
  actualizadaEn: string;
  cliente: UsuarioResumen;
  /** Quien la registro. Distinto del cliente cuando la agendo el personal. */
  registradaPor: UsuarioResumen;
  empleado: EmpleadoDeCita;
  servicio: ServicioDeCita;
  estado: EstadoCita;
  adicionales: AdicionalDeCita[];
};

/**
 * Lo que devuelve `GET /citas`. La paginacion viaja **dentro** de `data`, no como hermano
 * del sobre `{ success, data, message }`. Ver `apiBase/src/common/04-contrato-api.md`.
 *
 * `total` es el conteo con los mismos filtros que la pagina —el API corre las dos
 * consultas con el mismo `where` en una transaccion—, asi que "50 de 214" se pinta sin
 * una segunda llamada y sin riesgo de que el total no case con lo que se ve.
 */
export type PaginaCitas = {
  items: Cita[];
  total: number;
  /** Base cero. */
  pagina: number;
  limite: number;
};

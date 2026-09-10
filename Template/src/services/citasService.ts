import { apiClient } from '../api/client';
import type { Cita, EstadoCita, PaginaCitas, ServicioDeCita } from '../types/cita';

export type SlotDisponible = { inicio: string; fin: string };

export type Disponibilidad = {
  fecha: string;
  zonaHoraria: string;
  duracionMinutos: number;
  slots: SlotDisponible[];
};

/** Datos de quien reserva sin sesion. El telefono es su identidad. */
export type DatosCliente = {
  telefono: string;
  nombre: string;
  apellido?: string;
  email?: string;
};

export type ReservarPayload = {
  servicioId: string;
  empleadoId: string;
  inicio: string;
  adicionalIds?: string[];
  /** Solo cuando no hay sesion; con sesion el cliente sale del token. */
  cliente?: DatosCliente;
  /**
   * Opt-in para el aviso por WhatsApp. Solo cuenta cuando la reserva crea la ficha:
   * sobre un telefono que ya existe el servidor lo ignora, porque reservar con el
   * numero de otra persona no puede darle consentimiento en su nombre.
   */
  aceptaWhatsapp?: boolean;
  notas?: string;
};

/**
 * Cuerpo de `PATCH /citas/:id`. Todo opcional: sirve para reprogramar y para cambiar de
 * estado. Cualquier campo que mueva el espacio ocupado vuelve a pasar por la misma
 * verificacion de disponibilidad que una reserva nueva, asi que un 409 aqui es tan
 * normal como al reservar. Ver `02-reservas-concurrencia.md`.
 */
export type ActualizarCitaPayload = {
  servicioId?: string;
  empleadoId?: string;
  inicio?: string;
  adicionalIds?: string[];
  /** `EstadoCita.codigo`, no el id: es la llave estable del catalogo. */
  estadoCodigo?: string;
  notas?: string;
};

/**
 * El comprobante de `POST /citas`.
 *
 * **Es mas estrecho que `Cita` a proposito, y no es el mismo cuerpo en los dos casos.**
 * Con sesion el API devuelve la ficha completa; sin ella devuelve solo esto, porque el
 * telefono de un invitado puede pertenecer a un cliente ya registrado y contestar con su
 * ficha convertiria la reserva en una consulta de datos ajenos (`comprobanteDeInvitado`).
 *
 * Este tipo es la interseccion de los dos, que es lo unico que quien reserva puede leer
 * sin preguntarse si habia sesion. Para la ficha entera se pide `GET /citas/:id`, que ya
 * pasa por el guard de propiedad.
 */
export type CitaReservada = {
  id: string;
  inicio: string;
  fin: string;
  precioServicio: string;
  costoAdicionales: string;
  costoTotal: string;
  estado: EstadoCita;
  servicio: ServicioDeCita;
  empleado: { id: string; usuario: { nombre: string; apellido: string | null } };
};

/**
 * Lo que la pagina del enlace muestra: lo minimo. Nunca el telefono ni el resto de la
 * ficha del cliente — el enlace pudo haberse reenviado.
 */
export type CitaPorConfirmar = {
  servicio: string;
  profesional: string;
  inicio: string;
  fin: string;
  estado: string;
  confirmada: boolean;
};

export type FiltroCitas = {
  /** Inclusive, ISO 8601. */
  desde?: string;
  /** Exclusive, ISO 8601. */
  hasta?: string;
  /** Base cero. */
  pagina?: number;
  /** El API lo topa en 100; si no se manda, usa 50. */
  limite?: number;
};

function comoQuery(filtro: FiltroCitas = {}): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor !== undefined) {
      params.set(clave, String(valor));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const citasService = {
  // Siempre paginada: el API no devuelve la agenda entera ni aunque no se le pida nada.
  // A quien ve cada cita lo decide el servidor por rol (`filtroPorPropiedad`): un CLIENTE
  // recibe las suyas, un EMPLEADO su agenda, un ADMIN todas. Aqui no se filtra nada.
  list: (filtro?: FiltroCitas) => apiClient.get<PaginaCitas>(`/citas${comoQuery(filtro)}`),
  get: (id: string) => apiClient.get<Cita>(`/citas/${id}`),
  // La disponibilidad la calcula el servidor: aqui no se simula ni se adivina.
  disponibilidad: (params: { empleadoId: string; servicioId: string; fecha: string }) =>
    apiClient.get<Disponibilidad>(`/citas/disponibilidad?${new URLSearchParams(params)}`),
  reservar: (dto: ReservarPayload) => apiClient.post<CitaReservada>('/citas', dto),
  /**
   * Las dos operaciones del enlace de confirmacion son POST a proposito: WhatsApp
   * previsualiza los enlaces de un mensaje y los navegadores hacen prefetch, y un GET
   * que confirma confirmaria la cita solo, antes de que el cliente la vea.
   */
  consultarConfirmacion: (token: string) =>
    apiClient.post<CitaPorConfirmar>('/citas/confirmacion/consulta', { token }),
  confirmar: (token: string) => apiClient.post<CitaPorConfirmar>('/citas/confirmacion', { token }),
  /** Solo ADMIN y EMPLEADO. Un CLIENTE recibe 403 aunque la cita sea suya. */
  update: (id: string, dto: ActualizarCitaPayload) => apiClient.patch<Cita>(`/citas/${id}`, dto),
  /**
   * No borra la fila: pasa la cita a CANCELADA y libera el espacio. Devuelve la cita ya
   * cancelada, asi que quien la llama puede pintar el resultado sin volver a pedirla.
   */
  cancelar: (id: string, motivo?: string) =>
    apiClient.delete<Cita>(`/citas/${id}`, motivo ? { motivo } : undefined),
};

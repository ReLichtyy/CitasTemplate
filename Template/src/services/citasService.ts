import { apiClient } from '../api/client';

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

export type CitaReservada = {
  id: string;
  inicio: string;
  fin: string;
  costoTotal: string;
  estado: { codigo: string; nombre: string };
  servicio: { id: string; nombre: string };
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

export const citasService = {
  list: () => apiClient.get('/citas'),
  get: (id: string) => apiClient.get(`/citas/${id}`),
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
  confirmar: (token: string) =>
    apiClient.post<CitaPorConfirmar>('/citas/confirmacion', { token }),
  update: (id: string, dto: unknown) => apiClient.patch(`/citas/${id}`, dto),
  cancelar: (id: string) => apiClient.delete(`/citas/${id}`),
};

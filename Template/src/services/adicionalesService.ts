import { apiClient } from '../api/client';

/**
 * Lo que devuelve `GET /adicionales` — la lectura completa, con el `activo`: no hay
 * catalogo publico de adicionales, la lista es de gestion.
 */
export type AdicionalGestion = {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** `Decimal` de Prisma: llega como cadena y se formatea con `Intl`. Ver lib/formatPrice. */
  precio: string;
  /** Ofrecido al reservar. Apagarlo saca el adicional de la reserva, no de las citas viejas. */
  activo: boolean;
};

/**
 * Cuerpo de alta. El precio viaja como **cadena** con hasta dos decimales: es un `Decimal`
 * en la base, y pasarlo por un `number` de JavaScript le mete error de redondeo antes de
 * salir del navegador. El API lo valida con la misma forma.
 */
export type CrearAdicionalPayload = {
  nombre: string;
  descripcion?: string;
  precio: string;
  activo?: boolean;
};

/** Lo mismo, todo opcional: el API acepta un cuerpo parcial. */
export type ActualizarAdicionalPayload = Partial<CrearAdicionalPayload>;

export const adicionalesService = {
  list: () => apiClient.get<AdicionalGestion[]>('/adicionales'),
  get: (id: string) => apiClient.get<AdicionalGestion>(`/adicionales/${id}`),
  crear: (dto: CrearAdicionalPayload) =>
    apiClient.post<AdicionalGestion>('/adicionales', dto),
  actualizar: (id: string, dto: ActualizarAdicionalPayload) =>
    apiClient.patch<AdicionalGestion>(`/adicionales/${id}`, dto),
  /**
   * **Despublica, no borra.** El API apaga `activo` y devuelve el adicional: queda citado
   * en las `CitaAdicional` de citas pasadas y la llave no puede perderse. Desde el
   * formulario se vuelve a publicar.
   */
  despublicar: (id: string) => apiClient.delete<AdicionalGestion>(`/adicionales/${id}`),
};

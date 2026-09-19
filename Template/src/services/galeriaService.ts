import { apiClient } from '../api/client';

/** El servicio con el que se logro el resultado: es el subtitulo de la foto. */
export type ServicioDeFoto = {
  id: string;
  nombre: string;
};

/** Lo que devuelve `GET /galeria`: una foto de resultado, publicada tal como se agrego. */
export type FotoGaleria = {
  id: string;
  imagenUrl: string;
  descripcion: string | null;
  servicio: ServicioDeFoto;
};

/** Cuerpo de `POST /galeria`. La URL es la que devolvio `archivosService.subir`. */
export type CrearFotoGaleriaPayload = {
  imagenUrl: string;
  servicioId: string;
  descripcion?: string;
};

export const galeriaService = {
  list: () => apiClient.get<FotoGaleria[]>('/galeria'),
  crear: (dto: CrearFotoGaleriaPayload) => apiClient.post<FotoGaleria>('/galeria', dto),
  /**
   * Borra de verdad, fila y archivo — no es una despublicacion. Por eso quien lo llama
   * confirma antes, a diferencia de despublicar un producto.
   */
  eliminar: (id: string) => apiClient.delete<void>(`/galeria/${id}`),
};

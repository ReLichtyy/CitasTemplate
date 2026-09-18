import { apiClient } from '../api/client';

/** Lo que devuelve `POST /archivos`: la URL absoluta ya resuelta por el API. */
export type ArchivoSubido = {
  url: string;
};

export const archivosService = {
  /**
   * Sube la imagen y devuelve la URL que se persiste. El campo del multipart es `archivo`,
   * el mismo nombre que espera el `FileInterceptor` del API.
   */
  subir: (imagen: File) => {
    const cuerpo = new FormData();
    cuerpo.append('archivo', imagen);
    return apiClient.postArchivo<ArchivoSubido>('/archivos', cuerpo);
  },

  /**
   * Deshace una subida: se invoca cuando el guardado del recurso que iba a referenciar
   * la URL fallo despues de que la imagen ya subiera. Recibe la **URL** que devolvio
   * `subir` — de ahi saca el nombre — porque al modal eso es lo unico que le queda.
   * Mejor esfuerzo: si el borrado tampoco llega, el archivo queda huerfano, que es el
   * estado en el que ya estaba.
   */
  eliminar: (url: string) => {
    const nombre = new URL(url).pathname.split('/').pop();
    if (!nombre) {
      return Promise.reject(new Error('La URL de la imagen no tiene nombre de archivo.'));
    }
    return apiClient.delete<void>(`/archivos/${nombre}`);
  },
};

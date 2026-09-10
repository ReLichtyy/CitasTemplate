import { apiClient } from '../api/client';
import type { CategoriaProducto, Producto, ProductoGestion } from '../types/producto';

/**
 * Cuerpo de alta. El precio viaja como **cadena** con hasta dos decimales: es un `Decimal`
 * en la base, y pasarlo por un `number` de JavaScript le mete error de redondeo antes de
 * salir del navegador. El API lo valida con la misma forma.
 */
export type CrearProductoPayload = {
  categoriaId: string;
  nombre: string;
  descripcion?: string;
  precio: string;
  presentacion: string;
  imagenUrl?: string;
  activo?: boolean;
  disponible?: boolean;
};

/** Lo mismo, todo opcional: el API acepta un cuerpo parcial. */
export type ActualizarProductoPayload = Partial<CrearProductoPayload>;

export const productosService = {
  /** Catalogo publico: solo lo publicado, y sin el indicador de publicado. */
  list: () => apiClient.get<Producto[]>('/productos'),
  categorias: () => apiClient.get<CategoriaProducto[]>('/productos/categorias'),
  get: (id: string) => apiClient.get<Producto>(`/productos/${id}`),
  /**
   * Todo el catalogo, publicado o no. Solo ADMIN. Es una ruta aparte y no la publica con un
   * parametro: asi ninguna peticion del catalogo puede devolver de mas por descuido.
   */
  listarGestion: () => apiClient.get<ProductoGestion[]>('/productos/gestion'),
  crear: (dto: CrearProductoPayload) => apiClient.post<ProductoGestion>('/productos', dto),
  actualizar: (id: string, dto: ActualizarProductoPayload) =>
    apiClient.patch<ProductoGestion>(`/productos/${id}`, dto),
  /**
   * **Despublica, no borra.** El API apaga `activo` y devuelve el producto: sigue en la
   * lista de gestion y se puede volver a publicar. Un producto puede estar citado en una
   * recomendacion vieja, y borrarlo es lo unico de esta pantalla que no se deshace.
   */
  despublicar: (id: string) => apiClient.delete<ProductoGestion>(`/productos/${id}`),
};

// Formas del catalogo de productos. Las llenan `GET /productos`,
// `GET /productos/categorias` (publicas, solo lo publicado) y `GET /productos/gestion`
// (ADMIN, tambien lo despublicado).

export type CategoriaProducto = {
  id: string;
  nombre: string;
  /** Para que sirve, en una linea. Es lo que responde "por que me serviria". */
  promesa: string;
  descripcion: string | null;
};

/**
 * Un producto tal como lo ve un visitante.
 *
 * **No trae `activo`**, y es a proposito: para quien mira el catalogo no existe la nocion
 * de un producto despublicado, solo la de un catalogo. `disponible` si viene, porque es
 * otra cosa —hay existencias hoy— y es lo que pinta el chip de agotado.
 */
export type Producto = {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  /** `Decimal` de Prisma: llega como cadena y se formatea con `Intl`. Ver `lib/formatPrice`. */
  precio: string;
  /** Contenido o formato ("50 ml", "barra de 90 g"). */
  presentacion: string;
  /** Nulo mientras no haya foto; la card cae al monograma y la rejilla no se rompe. */
  imagenUrl: string | null;
  disponible: boolean;
};

/**
 * Lo que ve la gestion: el producto completo, publicado o no.
 *
 * Es un superconjunto de `Producto`, asi que `ProductoCard` y `ProductoModal` lo aceptan
 * sin cambios — que es lo que permite previsualizar en gestion lo mismo que ve el publico.
 */
export type ProductoGestion = Producto & {
  /** Publicado en el catalogo publico. Dar de baja lo apaga; nunca borra la fila. */
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
  categoria: { id: string; nombre: string };
};

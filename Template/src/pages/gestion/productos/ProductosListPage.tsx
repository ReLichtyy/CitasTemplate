import { useCallback, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { CARD_SHELL_CLASSES, Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ProductoFormModal } from '../../../components/ui/ProductoFormModal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Thumbnail } from '../../../components/ui/Thumbnail';
import { useAccionApi } from '../../../hooks/useAccionApi';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { formatPrice } from '../../../lib/formatPrice';
import {
  productosService,
  type ActualizarProductoPayload,
  type CrearProductoPayload,
} from '../../../services/productosService';
import type { ProductoGestion } from '../../../types/producto';

/** `null` es "cerrado"; `'nuevo'` es un alta; un producto es una edicion. */
type Edicion = null | 'nuevo' | ProductoGestion;

/**
 * Etiqueta de estado. Son **dos** indicadores y se pintan por separado a proposito: es la
 * distincion que nadie recuerda, y resumirla en una sola palabra la vuelve a perder.
 */
function EstadoProducto({ producto }: { producto: ProductoGestion }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
          producto.activo ? 'border-success-border text-success' : 'border-border text-text-muted'
        }`}
      >
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${producto.activo ? 'bg-success' : 'bg-text-muted'}`}
        />
        {producto.activo ? 'Publicado' : 'Sin publicar'}
      </span>
      {/* Solo cuando falta: en una lista larga, un chip "hay existencias" en cada fila es
          ruido. Lo que hay que ver de un vistazo es lo que esta agotado. */}
      {!producto.disponible && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-muted">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-text-muted" />
          Agotado
        </span>
      )}
    </div>
  );
}

/**
 * Gestion del catalogo de productos. Solo ADMIN llega aqui — `PATCH`/`POST`/`DELETE` de
 * `/productos` son `@Roles(ADMIN)` y un EMPLEADO recibiria 403.
 *
 * Lista, alta, edicion y despublicacion. **No hay borrado**: `DELETE /productos/:id` apaga
 * `activo` y el producto se queda en esta lista, recuperable. Un producto puede estar citado
 * en una recomendacion vieja, y borrarlo seria lo unico de esta pantalla que no se deshace.
 */
export function ProductosListPage() {
  const { moneda, locale, terminoProductoPlural } = configuracionPlaceholder;

  const [edicion, setEdicion] = useState<Edicion>(null);
  /** Sube al cambiar algo, y es la dependencia que hace que la lista se vuelva a pedir. */
  const [version, setVersion] = useState(0);

  const cargarProductos = useCallback(() => productosService.listarGestion(), []);
  const cargarCategorias = useCallback(() => productosService.categorias(), []);

  const productos = useRecursoApi(cargarProductos, [version]);
  const categorias = useRecursoApi(cargarCategorias, []);

  const guardar = useAccionApi((datos: CrearProductoPayload, id?: string) =>
    id ? productosService.actualizar(id, datos as ActualizarProductoPayload) : productosService.crear(datos),
  );
  const despublicar = useAccionApi((id: string) => productosService.despublicar(id));

  const enEdicion = edicion === 'nuevo' || edicion === null ? null : edicion;

  async function confirmarGuardado(datos: CrearProductoPayload) {
    const resultado = await guardar.ejecutar(datos, enEdicion?.id);
    if (resultado) {
      setEdicion(null);
      // Se vuelve a pedir la lista en vez de insertar el resultado en memoria: el orden lo
      // decide el API (categoria, luego nombre) y reproducirlo aqui seria una segunda
      // implementacion del mismo criterio.
      setVersion((n) => n + 1);
    }
  }

  async function confirmarDespublicar(producto: ProductoGestion) {
    if (await despublicar.ejecutar(producto.id)) {
      setVersion((n) => n + 1);
    }
  }

  const lista = productos.datos ?? [];

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title={terminoProductoPlural}
        actions={
          <Button
            className="shrink-0 px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm"
            onClick={() => {
              guardar.limpiarError();
              setEdicion('nuevo');
            }}
            // Sin categorias no hay alta posible: el formulario pediria elegir una de una
            // lista vacia. Es preferible el boton apagado a un dialogo sin salida.
            disabled={categorias.cargando || (categorias.datos ?? []).length === 0}
          >
            Agregar producto
          </Button>
        }
      />

      {productos.error && <Alert>{productos.error}</Alert>}
      {categorias.error && <Alert>{categorias.error}</Alert>}
      {despublicar.error && <Alert>{despublicar.error}</Alert>}

      {!categorias.cargando && !categorias.error && (categorias.datos ?? []).length === 0 && (
        <Alert>No hay categorias cargadas todavia, asi que no se puede agregar un producto.</Alert>
      )}

      {productos.cargando && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${CARD_SHELL_CLASSES} flex items-center gap-4 p-4`}>
              <Skeleton className="size-14 shrink-0 rounded-lg" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!productos.cargando && !productos.error && lista.length === 0 && (
        <EmptyState
          title="Sin productos"
          description="Agregue el primero con el boton de arriba."
        />
      )}

      {!productos.cargando && lista.length > 0 && (
        <div className="flex flex-col gap-3">
          {lista.map((producto) => (
            <Card
              key={producto.id}
              className={`flex flex-col gap-3 sm:flex-row sm:items-center ${producto.activo ? '' : 'opacity-70'}`}
            >
              <Thumbnail
                src={producto.imagenUrl}
                fallback={producto.nombre.charAt(0).toUpperCase()}
                className="size-14 shrink-0 rounded-lg text-xl"
              />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 truncate font-medium text-text-h">{producto.nombre}</p>
                  <EstadoProducto producto={producto} />
                </div>
                <p className="m-0 text-sm text-text-muted">
                  {producto.categoria.nombre} · {producto.presentacion} ·{' '}
                  <span className="font-medium tabular-nums text-price">
                    {formatPrice(producto.precio, moneda, locale)}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  className="min-h-11 px-4 py-2"
                  onClick={() => {
                    guardar.limpiarError();
                    setEdicion(producto);
                  }}
                >
                  Editar
                </Button>
                {/* Despublicar es reversible —se vuelve a publicar desde el formulario—, asi
                    que no lleva dialogo de confirmacion. El que lo lleva es cancelar una
                    cita, que suelta un espacio que otro puede tomar. */}
                {producto.activo && (
                  <Button
                    variant="secondary"
                    className="min-h-11 px-4 py-2"
                    disabled={despublicar.enviando}
                    onClick={() => confirmarDespublicar(producto)}
                  >
                    Despublicar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProductoFormModal
        abierto={edicion !== null}
        producto={enEdicion}
        categorias={categorias.datos ?? []}
        onCerrar={() => setEdicion(null)}
        onGuardar={confirmarGuardado}
        enviando={guardar.enviando}
        error={guardar.error}
      />
    </div>
  );
}

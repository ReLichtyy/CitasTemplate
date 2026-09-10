import { useCallback, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { ProductoCard } from '../../components/ui/ProductoCard';
import { ProductoModal } from '../../components/ui/ProductoModal';
import { SeccionHeader } from '../../components/ui/SeccionHeader';
import { SkeletonMediaCardGrid } from '../../components/ui/Skeleton';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { productosService } from '../../services/productosService';
import type { Producto } from '../../types/producto';

// La misma rejilla que los otros dos catalogos: tres rejillas distintas en un mismo sitio se
// leen como tres maquetaciones distintas.
const GRID_CLASSES = 'stagger-in grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3';

// Orden de encabezados: un solo h1 (el nombre del catalogo), un h2 por seccion y los tipos
// como h3 dentro de la primera. Saltar de h1 a h3 rompe la navegacion por encabezados de un
// lector de pantalla, que es como se recorre una pagina larga sin verla.

/**
 * Catalogo de productos.
 *
 * Dos lecturas y no una: las categorias traen el texto que ordena la pagina —que tipo de
 * producto hay y para que sirve cada uno— y los productos llenan las rejillas. Es el mismo
 * reparto que usa `EquipoPage`, y deja que cada cosa venga de su propia ruta.
 *
 * Antes esto salia de `lib/productosPlaceholder.ts`, que ademas era el unico archivo del
 * frontend con rubro. Ahora el rubro son filas de la base y esta pagina no sabe de cosmetica.
 */
export function ProductosPage() {
  const { moneda, locale, terminoProductoPlural } = configuracionPlaceholder;
  const [elegido, setElegido] = useState<Producto | null>(null);

  const cargarCategorias = useCallback(() => productosService.categorias(), []);
  const cargarProductos = useCallback(() => productosService.list(), []);

  const categorias = useRecursoApi(cargarCategorias, []);
  const productos = useRecursoApi(cargarProductos, []);

  const cargando = categorias.cargando || productos.cargando;
  // Basta con que falle una: media pagina de catalogo se lee como el catalogo entero, y el
  // visitante no tiene forma de saber que le falta la otra mitad.
  const error = categorias.error ?? productos.error;

  const listaCategorias = categorias.datos ?? [];
  const listaProductos = productos.datos ?? [];

  const categoriaElegida = elegido
    ? listaCategorias.find((categoria) => categoria.id === elegido.categoriaId)
    : null;

  return (
    <div className="flex flex-col gap-16 py-6 sm:gap-24 sm:py-10">
      <section className="flex flex-col gap-8 sm:gap-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl md:text-4xl">{terminoProductoPlural}</h1>
          <span className="h-px w-12 bg-accent/60" aria-hidden="true" />
          <p className="max-w-prose text-sm text-text">
            Lo que usamos durante la cita y lo que recomendamos para sostener el resultado en
            casa. Pocas referencias, elegidas por lo que hacen y no por la novedad.
          </p>
        </header>

        {error && <Alert>{error}</Alert>}

        {cargando && (
          <SkeletonMediaCardGrid count={6} className={GRID_CLASSES} aspecto="aspect-4/3" />
        )}

        {!cargando && !error && listaProductos.length === 0 && (
          <EmptyState
            title="Todavia no hay productos"
            description="Cuando el catalogo este cargado, aparece aqui."
          />
        )}

        {/* La seccion que ordena el resto: primero que tipo de producto hay y para que sirve
            cada uno, y recien despues el catalogo. Sin esto, una rejilla de nueve frascos
            obliga a deducir la logica leyendo etiquetas. */}
        {!cargando && listaCategorias.length > 0 && (
          <>
            <SeccionHeader
              eyebrow="Que ofrecemos"
              titulo="Cada tipo resuelve un trabajo distinto"
              descripcion="Cada uno resuelve una cosa. Sirven solos, y ordenados en ese mismo orden funcionan mejor."
              divisor
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {listaCategorias.map((categoria, indice) => (
                <Card key={categoria.id} className="flex flex-col gap-2">
                  <Eyebrow tono="acento" className="tabular-nums">
                    {`${indice + 1}`.padStart(2, '0')}
                  </Eyebrow>
                  {/* Sin `font-heading font-normal tracking-tight text-text-h`: index.css ya
                      se los aplica a todo h3. */}
                  <h3 className="text-xl sm:text-2xl">{categoria.nombre}</h3>
                  {/* La promesa es la respuesta a "por que me serviria": va antes que el
                      detalle y con mas peso, porque es lo que decide si sigue leyendo. */}
                  <p className="font-medium text-text-h">{categoria.promesa}</p>
                  {categoria.descripcion && (
                    <p className="text-sm leading-relaxed text-text-muted">
                      {categoria.descripcion}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Una seccion por categoria, en el orden que trajo el API. El indice sale del propio
          `map`: antes se buscaba con `indexOf` dentro del recorrido, que es la misma cuenta
          hecha dos veces. */}
      {!cargando &&
        listaCategorias.map((categoria, indice) => {
          const deLaCategoria = listaProductos.filter(
            (producto) => producto.categoriaId === categoria.id,
          );

          if (deLaCategoria.length === 0) {
            return null;
          }

          return (
            <section key={categoria.id} className="flex flex-col gap-8 sm:gap-10">
              <SeccionHeader
                eyebrow={`Tipo ${`${indice + 1}`.padStart(2, '0')}`}
                titulo={categoria.nombre}
                descripcion={categoria.promesa}
                divisor
              />
              <div className={GRID_CLASSES}>
                {deLaCategoria.map((producto) => (
                  <ProductoCard
                    key={producto.id}
                    producto={producto}
                    moneda={moneda}
                    locale={locale}
                    onSelect={() => setElegido(producto)}
                  />
                ))}
              </div>
            </section>
          );
        })}

      <ProductoModal
        producto={elegido}
        categoria={categoriaElegida ?? undefined}
        moneda={moneda}
        locale={locale}
        onClose={() => setElegido(null)}
      />
    </div>
  );
}

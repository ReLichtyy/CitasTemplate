import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { ProductoCard } from '../../components/ui/ProductoCard';
import { ProductoModal } from '../../components/ui/ProductoModal';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import {
  categoriasPlaceholder,
  productosPlaceholder,
  type Producto,
} from '../../lib/productosPlaceholder';

// La misma rejilla que los otros dos catalogos: tres rejillas distintas en un mismo sitio se
// leen como tres maquetaciones distintas.
const GRID_CLASSES = 'stagger-in grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3';

function SeccionHeader({
  eyebrow,
  titulo,
  bajada,
}: {
  eyebrow: string;
  titulo: string;
  bajada?: string;
}) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <Eyebrow tono="acento">{eyebrow}</Eyebrow>
      <h2 className="font-heading text-2xl font-normal tracking-tight text-text-h sm:text-3xl">
        {titulo}
      </h2>
      <span className="h-px w-12 bg-accent/60" aria-hidden="true" />
      {bajada && <p className="max-w-prose text-sm text-text">{bajada}</p>}
    </header>
  );
}

// Orden de encabezados: un solo h1 (el nombre del catalogo), un h2 por seccion y los cuatro
// tipos como h3 dentro de la primera. Saltar de h1 a h3 rompe la navegacion por encabezados
// de un lector de pantalla, que es como se recorre una pagina larga sin verla.

/**
 * Catalogo de productos.
 *
 * Los datos son locales (`lib/productosPlaceholder.ts`) porque el dominio todavia no existe
 * en el backend: por eso esta pagina no tiene cargando ni error, y no los simula. Cuando
 * exista `GET /productos` pasa a `useRecursoApi` como los otros catalogos, y lo unico que
 * cambia es de donde salen las dos listas.
 */
export function ProductosPage() {
  const { moneda, locale, terminoProductoPlural } = configuracionPlaceholder;
  const [elegido, setElegido] = useState<Producto | null>(null);

  const categoriaElegida = elegido
    ? categoriasPlaceholder.find((categoria) => categoria.id === elegido.categoriaId)
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

        {/* La seccion que ordena el resto: primero que tipo de producto hay y para que sirve
            cada uno, y recien despues el catalogo. Sin esto, una rejilla de nueve frascos
            obliga a deducir la logica leyendo etiquetas. */}
        <SeccionHeader
          eyebrow="Que ofrecemos"
          titulo="Cuatro cuidados, cuatro trabajos distintos"
          bajada="Cada tipo resuelve una cosa. Sirven solos, y ordenados en ese mismo orden funcionan mejor."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {categoriasPlaceholder.map((categoria, i) => (
            <Card key={categoria.id} className="flex flex-col gap-2">
              <Eyebrow tono="acento" className="tabular-nums">
                {`${i + 1}`.padStart(2, '0')}
              </Eyebrow>
              <h3 className="font-heading text-xl font-normal tracking-tight text-text-h sm:text-2xl">
                {categoria.nombre}
              </h3>
              {/* La promesa es la respuesta a "por que me serviria": va antes que el detalle
                  y con mas peso, porque es lo que decide si sigue leyendo. */}
              <p className="font-medium text-text-h">{categoria.promesa}</p>
              <p className="text-sm leading-relaxed text-text-muted">{categoria.descripcion}</p>
            </Card>
          ))}
        </div>
      </section>

      {categoriasPlaceholder.map((categoria) => {
        const productos = productosPlaceholder.filter(
          (producto) => producto.categoriaId === categoria.id,
        );

        if (productos.length === 0) {
          return null;
        }

        return (
          <section key={categoria.id} className="flex flex-col gap-8 sm:gap-10">
            <SeccionHeader
              eyebrow={`Tipo ${`${categoriasPlaceholder.indexOf(categoria) + 1}`.padStart(2, '0')}`}
              titulo={categoria.nombre}
              bajada={categoria.promesa}
            />
            <div className={GRID_CLASSES}>
              {productos.map((producto) => (
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

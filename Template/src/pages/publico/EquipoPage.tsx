import { useState, type ReactNode } from 'react';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { EmptyState } from '../../components/ui/EmptyState';
import { EspecialistaCard } from '../../components/ui/EspecialistaCard';
import { Modal } from '../../components/ui/Modal';
import { ServicioCard } from '../../components/ui/ServicioCard';
import { SkeletonMediaCardGrid } from '../../components/ui/Skeleton';
import { StarIcon } from '../../components/ui/StarIcon';
import { Thumbnail } from '../../components/ui/Thumbnail';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { aEspecialista, iniciales, nombreCompleto } from '../../lib/especialista';
import { formatDuration } from '../../lib/formatDuration';
import { formatFecha } from '../../lib/formatFecha';
import { formatPrice } from '../../lib/formatPrice';
import { empleadosService } from '../../services/empleadosService';
import { serviciosService } from '../../services/serviciosService';
import type { Especialista, Servicio } from '../../types/catalogo';

// 08-pagina-especialistas.md: las dos rejillas son la misma a proposito. Una sola constante lo garantiza.
const GRID_CLASSES = 'stagger-in grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3';

/**
 * Los tres caminos de una seccion que viene del API, en un solo lugar: cargando, error y
 * catalogo vacio. Cada seccion los resuelve por su cuenta —son dos peticiones
 * independientes— y sin esto cada una los escribiria a su manera.
 */
function EstadoSeccion({
  cargando,
  error,
  vacio,
  tituloVacio,
  esqueleto,
  children,
}: {
  cargando: boolean;
  error: string | null;
  vacio: boolean;
  tituloVacio: string;
  /** El placeholder tiene la forma de la card de esa seccion: las dos no miden igual. */
  esqueleto: ReactNode;
  children: ReactNode;
}) {
  if (cargando) {
    return <>{esqueleto}</>;
  }
  if (error) {
    return <Alert>{error}</Alert>;
  }
  if (vacio) {
    return <EmptyState title={tituloVacio} description="Vuelva a intentarlo mas tarde." />;
  }
  return <>{children}</>;
}

// Encabezado de seccion: centrado, con una regla de acento corta debajo. Las dos
// secciones lo comparten para que se lean como parte de la misma pagina.
function SeccionHeader({ children, nivel }: { children: string; nivel: 1 | 2 }) {
  const Titulo = nivel === 1 ? 'h1' : 'h2';
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <Titulo
        className={
          nivel === 1
            ? 'text-3xl font-semibold tracking-tight md:text-4xl'
            : 'text-2xl font-semibold tracking-tight text-text-h md:text-3xl'
        }
      >
        {children}
      </Titulo>
      <span className="h-px w-12 bg-accent/60" aria-hidden="true" />
    </header>
  );
}

export function EquipoPage() {
  const { moneda, locale, terminoEmpleadoPlural, terminoServicioPlural } = configuracionPlaceholder;
  const [especialista, setEspecialista] = useState<Especialista | null>(null);
  const [servicio, setServicio] = useState<Servicio | null>(null);

  // Dos peticiones independientes a proposito: que el catalogo de servicios tarde o falle
  // no debe dejar en blanco la seccion de especialistas, que ya podria estar lista.
  const empleados = useRecursoApi(() => empleadosService.list());
  const servicios = useRecursoApi(() => serviciosService.list());

  const especialistas = (empleados.datos ?? []).map(aEspecialista);
  const catalogo = servicios.datos ?? [];

  return (
    <div className="flex flex-col gap-16 py-6 sm:gap-24 sm:py-10">
      <section className="flex flex-col gap-8 sm:gap-10">
        <SeccionHeader nivel={1}>{terminoEmpleadoPlural}</SeccionHeader>
        <EstadoSeccion
          cargando={empleados.cargando}
          error={empleados.error}
          vacio={especialistas.length === 0}
          tituloVacio={`Todavia no hay ${terminoEmpleadoPlural.toLowerCase()} publicados.`}
          esqueleto={
            <SkeletonMediaCardGrid className={GRID_CLASSES} aspecto="aspect-square sm:aspect-4/5" />
          }
        >
          <div className={GRID_CLASSES}>
            {especialistas.map((item) => (
              <EspecialistaCard
                key={item.id}
                especialista={item}
                onSelect={() => setEspecialista(item)}
              />
            ))}
          </div>
        </EstadoSeccion>
      </section>

      {/* scroll-mt deja aire bajo la navbar fija cuando se entra por #servicios. */}
      <section id="servicios" className="flex scroll-mt-24 flex-col gap-8 sm:gap-10">
        <SeccionHeader nivel={2}>{terminoServicioPlural}</SeccionHeader>
        <EstadoSeccion
          cargando={servicios.cargando}
          error={servicios.error}
          vacio={catalogo.length === 0}
          tituloVacio={`Todavia no hay ${terminoServicioPlural.toLowerCase()} publicados.`}
          esqueleto={<SkeletonMediaCardGrid className={GRID_CLASSES} aspecto="aspect-4/3" />}
        >
          <div className={GRID_CLASSES}>
            {catalogo.map((item) => (
              <ServicioCard
                key={item.id}
                servicio={item}
                moneda={moneda}
                locale={locale}
                onSelect={() => setServicio(item)}
              />
            ))}
          </div>
        </EstadoSeccion>
      </section>

      <Modal
        open={especialista !== null}
        onClose={() => setEspecialista(null)}
        titulo={especialista ? nombreCompleto(especialista.nombre, especialista.apellido) : ''}
      >
        {especialista && (
          <div className="flex flex-col gap-5">
            {/* Con foto, retrato ancho como el del servicio; sin ella, la fila compacta de
                siempre — un banner de 224 px relleno con dos iniciales es mucho vacio. En
                los dos casos pasa por Thumbnail, asi que una URL podrida cae a las
                iniciales y no al icono de imagen rota. */}
            {especialista.fotoUrl ? (
              <div className="flex flex-col gap-3">
                {/* En el detalle la foto va limpia: sin foco ni desaturacion, que son de la
                    card. Aqui la imagen es el contenido, no el fondo de un titulo. */}
                <Thumbnail
                  src={especialista.fotoUrl}
                  fallback={iniciales(especialista.nombre, especialista.apellido)}
                  className="aspect-4/3 w-full rounded-lg text-5xl"
                />
                {especialista.especialidad && (
                  <p className="text-sm font-medium text-text-muted">
                    {especialista.especialidad}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Thumbnail
                  src={especialista.fotoUrl}
                  fallback={iniciales(especialista.nombre, especialista.apellido)}
                  className="h-16 w-16 rounded-full text-lg"
                />
                {especialista.especialidad && (
                  <p className="text-sm font-medium text-text-muted">
                    {especialista.especialidad}
                  </p>
                )}
              </div>
            )}

            {especialista.bio && <p className="text-sm leading-relaxed">{especialista.bio}</p>}

            {especialista.rating && (
              <div className="flex flex-col gap-4 border-t border-border/70 pt-4">
                <div className="flex items-center gap-2.5">
                  <StarIcon className="h-7 w-7 shrink-0 text-price" />
                  <p className="text-3xl leading-none font-bold tracking-tight tabular-nums text-text-h">
                    {especialista.rating.promedio.toFixed(1)}
                  </p>
                  <p className="self-end text-xs text-text-muted">
                    {especialista.rating.total} resenas
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-center text-sm font-semibold tracking-tight text-text-h">
                    Ultimas Reseñas
                  </h3>
                  {/* Dos lineas por resena: autor y puntuacion comparten fila. Tres lineas
                      era lo que hacia ver esta seccion pesada en un telefono. */}
                  {especialista.rating.ultimasResenas.slice(0, 3).map((resena) => (
                    <div
                      key={resena.id}
                      className="flex flex-col gap-0.5 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-baseline gap-1.5 text-xs font-semibold text-text-h">
                          {resena.autor}
                          <span className="inline-flex items-center gap-0.5 font-bold text-price">
                            <StarIcon className="h-2.5 w-2.5 translate-y-px" />
                            <span className="tabular-nums">{resena.puntuacion.toFixed(1)}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-text-muted">
                          {formatFecha(resena.fecha, locale)}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{resena.comentario}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={servicio !== null}
        onClose={() => setServicio(null)}
        titulo={servicio?.nombre ?? ''}
      >
        {servicio && (
          <div className="flex flex-col gap-4">
            {servicio.imagenUrl && (
              <Thumbnail
                src={servicio.imagenUrl}
                fallback={servicio.nombre.charAt(0).toUpperCase()}
                className="aspect-4/3 w-full rounded-lg text-5xl"
              />
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="whitespace-nowrap text-sm text-text-muted">
                {formatDuration(servicio.duracionMinutos)}
              </span>
              <span className="text-xl font-bold tabular-nums text-price">
                {formatPrice(servicio.precio, moneda, locale)}
              </span>
            </div>
            {servicio.descripcion && (
              <p className="text-sm leading-relaxed">{servicio.descripcion}</p>
            )}
            <ButtonLink to="/citas/reservar" className="w-full">
              Agendar Cita
            </ButtonLink>
          </div>
        )}
      </Modal>
    </div>
  );
}

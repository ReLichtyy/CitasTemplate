import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { CARD_MEDIA_INTERACTIVE_CLASSES } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonMediaCardGrid } from '../../components/ui/Skeleton';
import { Thumbnail } from '../../components/ui/Thumbnail';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { nombreCompleto } from '../../lib/especialista';
import { empleadosService } from '../../services/empleadosService';
import { serviciosService } from '../../services/serviciosService';

const GRID_CLASSES = 'stagger-in grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4';

type ItemGaleria = {
  id: string;
  imagenUrl: string;
  titulo: string;
  subtitulo: string;
  to: string;
};

/**
 * Galeria de fotos reales del negocio: no es un dominio propio (no hay endpoint de
 * "portfolio" en el API) sino una vidriera de las fotos que ya existen en el catalogo de
 * servicios y en las fichas del equipo. Un servicio o un especialista sin foto no aparece
 * aqui — esta pagina es solo imagenes, y ya tienen su lugar con monograma en /servicios y
 * /equipo.
 */
export function GaleriaPage() {
  const { terminoServicioPlural, terminoEmpleadoPlural } = configuracionPlaceholder;
  const servicios = useRecursoApi(() => serviciosService.list());
  const empleados = useRecursoApi(() => empleadosService.list());

  const cargando = servicios.cargando || empleados.cargando;
  // Basta con que falle una: media galeria se lee como la galeria entera.
  const error = servicios.error ?? empleados.error;

  const itemsServicios: ItemGaleria[] = (servicios.datos ?? [])
    .filter((s) => !!s.imagenUrl)
    .map((s) => ({
      id: `servicio-${s.id}`,
      imagenUrl: s.imagenUrl as string,
      titulo: s.nombre,
      subtitulo: terminoServicioPlural,
      to: '/servicios',
    }));

  const itemsEquipo: ItemGaleria[] = (empleados.datos ?? [])
    .filter((e) => !!e.fotoUrl)
    .map((e) => ({
      id: `empleado-${e.id}`,
      imagenUrl: e.fotoUrl as string,
      titulo: nombreCompleto(e.usuario.nombre, e.usuario.apellido),
      subtitulo: e.especialidad?.nombre ?? terminoEmpleadoPlural,
      to: '/equipo',
    }));

  const items = [...itemsServicios, ...itemsEquipo];

  return (
    <main className="flex flex-col gap-8 py-6 sm:gap-10 sm:py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Galeria</h1>
        <span className="h-px w-12 bg-accent/60" aria-hidden="true" />
        <p className="max-w-prose text-sm text-text">
          Fotos reales del catalogo: cada una lleva al servicio o a la persona con la que se
          hace.
        </p>
      </header>

      {cargando && <SkeletonMediaCardGrid count={6} className={GRID_CLASSES} aspecto="aspect-square" />}
      {!cargando && error && <Alert>{error}</Alert>}
      {!cargando && !error && items.length === 0 && (
        <EmptyState
          title="Todavia no hay fotos publicadas"
          description="Cuando el catalogo tenga imagenes, aparecen aqui."
        />
      )}

      {!cargando && !error && items.length > 0 && (
        <div className={GRID_CLASSES}>
          {items.map((item) => (
            <Link key={item.id} to={item.to} className={`${CARD_MEDIA_INTERACTIVE_CLASSES} block`}>
              <div className="relative aspect-square">
                <Thumbnail
                  src={item.imagenUrl}
                  fallback={item.titulo.charAt(0).toUpperCase()}
                  className="h-full w-full text-3xl saturate-75 transition-[transform,filter] duration-300 group-hover:scale-105 group-hover:saturate-100"
                />
                <div className="foco-imagen pointer-events-none absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="line-clamp-1 text-sm font-semibold text-white">{item.titulo}</p>
                  <p className="line-clamp-1 text-xs text-white/80">{item.subtitulo}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

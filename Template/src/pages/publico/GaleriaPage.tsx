import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { CARD_MEDIA_INTERACTIVE_CLASSES } from '../../components/ui/Card';
import { DialogoQuitarFoto } from '../../components/ui/DialogoQuitarFoto';
import { EmptyState } from '../../components/ui/EmptyState';
import { GaleriaFormModal } from '../../components/ui/GaleriaFormModal';
import { SkeletonMediaCardGrid } from '../../components/ui/Skeleton';
import { Thumbnail } from '../../components/ui/Thumbnail';
import { useAuth } from '../../context/AuthContext';
import { useAccionApi } from '../../hooks/useAccionApi';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { construirGaleria, type ItemGaleria } from '../../lib/galeria';
import { empleadosService } from '../../services/empleadosService';
import { galeriaService, type CrearFotoGaleriaPayload } from '../../services/galeriaService';
import { serviciosService } from '../../services/serviciosService';

const GRID_CLASSES = 'stagger-in grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4';

/** Icono de la accion de quitar sobre la foto, para el personal. */
function IconoQuitar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      className="size-5"
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  );
}

/**
 * Galeria de fotos reales del negocio: la vidriera de las fotos que ya existen en el
 * catalogo de servicios y en las fichas del equipo, **mas** las fotos de resultado que el
 * personal agrega con el servicio que las produjo. Un servicio o un especialista sin foto
 * no aparece aqui — esta pagina es solo imagenes, y ya tienen su lugar con monograma en
 * /servicios y /equipo.
 *
 * ADMIN y EMPLEADO ademas administran: agregan fotos nuevas y quitan las agregadas. El
 * visitante solo ve la rejilla.
 */
export function GaleriaPage() {
  const { terminoServicioPlural, terminoEmpleadoPlural } = configuracionPlaceholder;
  const { rol } = useAuth();
  const esPersonal = rol === 'ADMIN' || rol === 'EMPLEADO';

  const servicios = useRecursoApi(() => serviciosService.list());
  const empleados = useRecursoApi(() => empleadosService.list());

  const [modalAbierto, setModalAbierto] = useState(false);
  const [porQuitar, setPorQuitar] = useState<ItemGaleria | null>(null);
  /** Sube al agregar o quitar una foto, y es la dependencia que la vuelve a pedir. */
  const [version, setVersion] = useState(0);
  const cargarFotos = useCallback(() => galeriaService.list(), []);
  const fotos = useRecursoApi(cargarFotos, [version]);

  const guardar = useAccionApi((dto: CrearFotoGaleriaPayload) => galeriaService.crear(dto));
  const quitar = useAccionApi((id: string) => galeriaService.eliminar(id));

  const cargando = servicios.cargando || empleados.cargando || fotos.cargando;
  // Basta con que falle una: media galeria se lee como la galeria entera.
  const error = servicios.error ?? fotos.error ?? empleados.error;

  const items = construirGaleria(
    servicios.datos ?? [],
    fotos.datos ?? [],
    empleados.datos ?? [],
    terminoServicioPlural,
    terminoEmpleadoPlural,
  );

  const catalogoServicios = servicios.datos ?? [];

  async function confirmarGuardado(datos: CrearFotoGaleriaPayload) {
    const resultado = await guardar.ejecutar(datos);
    if (resultado) {
      setModalAbierto(false);
      // Se vuelve a pedir la lista en vez de insertar el resultado en memoria: el orden
      // lo decide el API (la mas reciente primero) y reproducirlo aqui seria una segunda
      // implementacion del mismo criterio.
      setVersion((n) => n + 1);
    }
    // El modal lo espera: con false sabe que la imagen que subio justo antes quedo sin
    // la fila que la referencia, y la deshace.
    return resultado !== null;
  }

  async function confirmarQuitar() {
    if (!porQuitar?.fotoId) {
      return;
    }
    if (await quitar.ejecutar(porQuitar.fotoId)) {
      setPorQuitar(null);
      setVersion((n) => n + 1);
    }
  }

  return (
    <main className="flex flex-col gap-8 py-6 sm:gap-10 sm:py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Galeria</h1>
        <span className="h-px w-12 bg-accent/60" aria-hidden="true" />
        <p className="max-w-prose text-sm text-text">
          Fotos reales del catalogo y de los resultados: cada una lleva al servicio o a la
          persona con la que se hace.
        </p>
        {esPersonal && (
          // Sin servicios publicados no hay foto que agregar: el resultado se logro con
          // uno de ellos. Es preferible el boton apagado a un dialogo sin salida.
          <Button
            className="px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm"
            disabled={cargando || catalogoServicios.length === 0}
            onClick={() => {
              guardar.limpiarError();
              setModalAbierto(true);
            }}
          >
            Agregar foto
          </Button>
        )}
      </header>

      {esPersonal && !cargando && !servicios.error && catalogoServicios.length === 0 && (
        <Alert>No hay servicios publicados todavia, asi que no se puede agregar una foto.</Alert>
      )}

      {cargando && <SkeletonMediaCardGrid count={6} className={GRID_CLASSES} aspecto="aspect-square" />}
      {!cargando && error && <Alert>{error}</Alert>}
      {!cargando && !error && items.length === 0 && (
        <EmptyState
          title="Todavia no hay fotos publicadas"
          description="Cuando el catalogo tenga imagenes o el personal agregue resultados, aparecen aqui."
        />
      )}

      {!cargando && !error && items.length > 0 && (
        <div className={GRID_CLASSES}>
          {items.map((item) => (
            // El envoltorio deja al boton de quitar **fuera** del enlace: un elemento
            // interactivo dentro de otro no es navegable con teclado.
            <div key={item.id} className="relative">
              <Link to={item.to} className={`${CARD_MEDIA_INTERACTIVE_CLASSES} block`}>
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
              {esPersonal && item.fotoId && (
                <button
                  type="button"
                  aria-label={`Quitar de la galeria: ${item.titulo}`}
                  disabled={quitar.enviando}
                  onClick={() => {
                    quitar.limpiarError();
                    setPorQuitar(item);
                  }}
                  className="absolute right-2 top-2 grid size-11 place-items-center rounded-lg bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <IconoQuitar />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <GaleriaFormModal
        abierto={modalAbierto}
        servicios={catalogoServicios}
        onCerrar={() => setModalAbierto(false)}
        onGuardar={confirmarGuardado}
        enviando={guardar.enviando}
        error={guardar.error}
      />

      <DialogoQuitarFoto
        foto={porQuitar}
        abierto={porQuitar !== null}
        onCerrar={() => setPorQuitar(null)}
        onConfirmar={confirmarQuitar}
        enviando={quitar.enviando}
        error={quitar.error}
      />
    </main>
  );
}

import { useCallback, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { GestionItemRow } from '../../../components/gestion/GestionItemRow';
import { GestionLayout } from '../../../components/gestion/GestionLayout';
import { ServicioFormModal } from '../../../components/ui/ServicioFormModal';
import { useAccionApi } from '../../../hooks/useAccionApi';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { useAuth } from '../../../context/AuthContext';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { formatDuration } from '../../../lib/formatDuration';
import { formatPrice } from '../../../lib/formatPrice';
import { empleadosService } from '../../../services/empleadosService';
import {
  serviciosService,
  type ActualizarServicioPayload,
  type CrearServicioPayload,
} from '../../../services/serviciosService';
import type { ServicioGestion } from '../../../services/serviciosService';

/** `null` es "cerrado"; `'nuevo'` es un alta; un servicio es una edicion. */
type Edicion = null | 'nuevo' | ServicioGestion;

/** Etiqueta de estado. Igual razon de ser que `EstadoProducto` en la lista de productos. */
function EstadoServicio({ servicio }: { servicio: ServicioGestion }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        servicio.activo
          ? 'border-success-border text-success'
          : 'border-border text-text-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${servicio.activo ? 'bg-success' : 'bg-text-muted'}`}
      />
      {servicio.activo ? 'Publicado' : 'Sin publicar'}
    </span>
  );
}

/**
 * Listado de gestion: todo el catalogo, publicado o no, con alta, edicion y despublicacion.
 *
 * **No hay borrado**: un servicio cuelga del historial de cada cita que lo reservo, y
 * despublicarlo es lo unico de esta pantalla que no se deshace. La fila navega a la ficha
 * solo mientras esta publicada — la ficha publica es la que existe; sin publicar, la
 * edicion vive en el modal.
 */
export function ServiciosListPage() {
  const { moneda, locale, terminoServicioPlural } = configuracionPlaceholder;
  const { rol } = useAuth();
  const esAdmin = rol === 'ADMIN';

  const [edicion, setEdicion] = useState<Edicion>(null);
  /** Sube al cambiar algo, y es la dependencia que hace que la lista se vuelva a pedir. */
  const [version, setVersion] = useState(0);

  const cargarServicios = useCallback(() => serviciosService.listarGestion(), []);
  // La asignacion de profesionales del formulario: todo el equipo, dado de baja incluido.
  const cargarEmpleados = useCallback(() => empleadosService.listarGestion(), []);
  const servicios = useRecursoApi(cargarServicios, [version]);
  const empleados = useRecursoApi(cargarEmpleados, []);

  const guardar = useAccionApi((datos: CrearServicioPayload, id?: string) =>
    id
      ? serviciosService.actualizar(id, datos as ActualizarServicioPayload)
      : serviciosService.crear(datos),
  );
  const despublicar = useAccionApi((id: string) => serviciosService.despublicar(id));

  const enEdicion = edicion === 'nuevo' || edicion === null ? null : edicion;

  async function confirmarGuardado(datos: CrearServicioPayload) {
    const resultado = await guardar.ejecutar(datos, enEdicion?.id);
    if (resultado) {
      setEdicion(null);
      // Se vuelve a pedir la lista en vez de insertar el resultado en memoria: el orden
      // lo decide el API y reproducirlo aqui seria una segunda implementacion del criterio.
      setVersion((n) => n + 1);
    }
    // El modal lo espera: con false sabe que la imagen que subio justo antes quedo sin
    // el registro que la referencia, y la deshace.
    return resultado !== null;
  }

  async function confirmarDespublicar(servicio: ServicioGestion) {
    if (await despublicar.ejecutar(servicio.id)) {
      setVersion((n) => n + 1);
    }
  }

  const lista = servicios.datos ?? [];

  /**
   * La fila navega por el cuerpo y no por los botones (`GestionItemRow`), y solo mientras
   * esta publicada: la ficha que existe del otro lado es la publica, y sin publicar la
   * edicion vive en el modal.
   */
  const fila = (servicio: ServicioGestion) => (
    <GestionItemRow
      imagen={servicio.imagenUrl}
      monograma={servicio.nombre.charAt(0).toUpperCase()}
      titulo={servicio.nombre}
      subtitulo={`${formatDuration(servicio.duracionMinutos)} · ${
        servicio.empleados.length === 0
          ? 'sin asignar'
          : `${servicio.empleados.length} ${servicio.empleados.length === 1 ? 'profesional' : 'profesionales'}`
      }`}
      precio={formatPrice(servicio.precio, moneda, locale)}
      chip={!servicio.activo ? <EstadoServicio servicio={servicio} /> : undefined}
      a={servicio.activo ? `/gestion/servicios/${servicio.id}` : undefined}
      atenuada={!servicio.activo}
      acciones={
        esAdmin && (
          <>
            <Button
              variant="secondary"
              className="min-h-11 px-4 py-2"
              onClick={() => {
                guardar.limpiarError();
                setEdicion(servicio);
              }}
            >
              Editar
            </Button>
            {/* Despublicar es reversible —se vuelve a publicar desde el formulario—,
                asi que no lleva dialogo de confirmacion. */}
            {servicio.activo && (
              <Button
                variant="secondary"
                className="min-h-11 px-4 py-2"
                disabled={despublicar.enviando}
                onClick={() => confirmarDespublicar(servicio)}
              >
                Despublicar
              </Button>
            )}
          </>
        )
      }
    />
  );

  return (
    <GestionLayout
      pestana="servicios"
      titulo={terminoServicioPlural}
      acciones={
        esAdmin && (
          <Button
            className="shrink-0 px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm"
            onClick={() => {
              guardar.limpiarError();
              setEdicion('nuevo');
            }}
          >
            Agregar servicio
          </Button>
        )
      }
    >

      {servicios.error && <Alert>{servicios.error}</Alert>}
      {empleados.error && <Alert>{empleados.error}</Alert>}
      {despublicar.error && <Alert>{despublicar.error}</Alert>}

      {servicios.cargando && (
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

      {!servicios.cargando && !servicios.error && lista.length === 0 && (
        <EmptyState
          title={`Sin ${terminoServicioPlural.toLowerCase()}`}
          description="Agregue el primero con el boton de arriba."
        />
      )}

      {!servicios.cargando && lista.length > 0 && (
        <div className="flex flex-col gap-3">{lista.map(fila)}</div>
      )}

      <ServicioFormModal
        abierto={edicion !== null}
        servicio={enEdicion}
        empleados={empleados.datos ?? []}
        onCerrar={() => setEdicion(null)}
        onGuardar={confirmarGuardado}
        enviando={guardar.enviando}
        error={guardar.error}
      />
    </GestionLayout>
  );
}

import { useCallback, useState } from 'react';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { EmpleadoFormModal } from '../../../components/ui/EmpleadoFormModal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StarIcon } from '../../../components/ui/StarIcon';
import { GestionItemRow } from '../../../components/gestion/GestionItemRow';
import { GestionLayout } from '../../../components/gestion/GestionLayout';
import { useAccionApi } from '../../../hooks/useAccionApi';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { useAuth } from '../../../context/AuthContext';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { iniciales, nombreCompleto } from '../../../lib/especialista';
import { especialidadesService } from '../../../services/especialidadesService';
import { empleadosService } from '../../../services/empleadosService';
import {
  serviciosService,
  type ServicioGestion,
} from '../../../services/serviciosService';
import type {
  EmpleadoGestion,
  ActualizarEmpleadoPayload,
  CrearEmpleadoPayload,
} from '../../../services/empleadosService';

/** `null` es "cerrado"; `'nuevo'` es un alta; una ficha es una edicion. */
type Edicion = null | 'nuevo' | EmpleadoGestion;

/**
 * Etiqueta de ficha. Es un unico indicador a proposito: el API apaga el catalogo publico y
 * el acceso juntos, porque una persona dada de baja no queda dentro de la gestion con su
 * sesion viva.
 */
function EstadoEmpleado() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-muted">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-text-muted" />
      Dado de baja
    </span>
  );
}

/**
 * Listado de gestion: todo el equipo, dado de baja incluido, con alta, edicion y baja.
 *
 * La fila navega por el cuerpo y no por los botones — un boton dentro de un `<Link>`
 * dispararia la navegacion al pulsarlo — y solo navega mientras la ficha esta activa: la
 * ficha que existe del otro lado es la publica.
 */
export function EmpleadosListPage() {
  const { terminoEmpleadoPlural } = configuracionPlaceholder;
  const { rol } = useAuth();
  const esAdmin = rol === 'ADMIN';

  const [edicion, setEdicion] = useState<Edicion>(null);
  /** Sube al cambiar algo, y es la dependencia que hace que la lista se vuelva a pedir. */
  const [version, setVersion] = useState(0);

  const cargarEmpleados = useCallback(() => empleadosService.listarGestion(), []);
  // El rating no viene en la ficha de gestion: lo calcula la lectura publica con las
  // resenas. Es la misma doble lectura de las paginas del catalogo (ver 08-pagina-especialistas),
  // y solo cubre a los activos — un dado de baja ya no se califica en ninguna parte.
  const cargarRatings = useCallback(() => empleadosService.list(), []);
  // El formulario de alta necesita las dos listas que se le asignan a una persona.
  const cargarEspecialidades = useCallback(() => especialidadesService.list(), []);
  const cargarServicios = useCallback(() => serviciosService.listarGestion(), []);
  const empleados = useRecursoApi(cargarEmpleados, [version]);
  const ratings = useRecursoApi(cargarRatings, [version]);
  const ratingDe = (id: string) =>
    (ratings.datos ?? []).find((publico) => publico.id === id)?.rating ?? null;
  const especialidades = useRecursoApi(cargarEspecialidades, []);
  const servicios = useRecursoApi<ServicioGestion[]>(cargarServicios, []);

  const guardar = useAccionApi(
    (datos: CrearEmpleadoPayload | ActualizarEmpleadoPayload, id?: string) =>
      id
        ? empleadosService.actualizar(id, datos as ActualizarEmpleadoPayload)
        : empleadosService.crear(datos as CrearEmpleadoPayload),
  );
  const darBaja = useAccionApi((id: string) => empleadosService.darBaja(id));

  const enEdicion = edicion === 'nuevo' || edicion === null ? null : edicion;

  async function confirmarGuardado(datos: CrearEmpleadoPayload | ActualizarEmpleadoPayload) {
    const resultado = await guardar.ejecutar(datos, enEdicion?.id);
    if (resultado) {
      setEdicion(null);
      setVersion((n) => n + 1);
    }
    // El modal lo espera: con false sabe que la foto que subio justo antes quedo sin
    // la ficha que la referencia, y la deshace.
    return resultado !== null;
  }

  async function confirmarBaja(empleado: EmpleadoGestion) {
    if (await darBaja.ejecutar(empleado.id)) {
      setVersion((n) => n + 1);
    }
  }

  const lista = empleados.datos ?? [];

  const fila = (empleado: EmpleadoGestion) => (
    <GestionItemRow
      imagen={empleado.fotoUrl}
      monograma={iniciales(empleado.usuario.nombre, empleado.usuario.apellido)}
      redondo
      titulo={nombreCompleto(empleado.usuario.nombre, empleado.usuario.apellido)}
      subtitulo={empleado.especialidad?.nombre ?? 'Sin especialidad'}
      meta={
        <>
          {empleado.activo && ratingDe(empleado.id) && (
            <span className="inline-flex items-center gap-1 font-medium text-text-h">
              <StarIcon className="h-3.5 w-3.5 text-price" />
              <span className="tabular-nums">{ratingDe(empleado.id)!.promedio.toFixed(1)}</span>
            </span>
          )}
          <span>
            {empleado.servicios.length === 0
              ? 'Sin servicios'
              : `${empleado.servicios.length} ${
                  empleado.servicios.length === 1 ? 'servicio' : 'servicios'
                }`}
          </span>
        </>
      }
      chip={!empleado.activo ? <EstadoEmpleado /> : undefined}
      a={empleado.activo ? `/gestion/empleados/${empleado.id}` : undefined}
      atenuada={!empleado.activo}
      acciones={
        esAdmin && (
          <>
            <Button
              variant="secondary"
              className="min-h-11 px-4 py-2"
              onClick={() => {
                guardar.limpiarError();
                setEdicion(empleado);
              }}
            >
              Editar
            </Button>
            {/* La baja es reversible —se reactiva desde el formulario— y es la que corta
                el acceso, asi que no lleva dialogo: la pantalla que lo lleva es la que
                suelta un espacio que otro puede tomar. */}
            {empleado.activo && (
              <Button
                variant="secondary"
                className="min-h-11 px-4 py-2"
                disabled={darBaja.enviando}
                onClick={() => confirmarBaja(empleado)}
              >
                Dar de baja
              </Button>
            )}
          </>
        )
      }
    />
  );

  return (
    <GestionLayout
      pestana="empleados"
      titulo={terminoEmpleadoPlural}
      acciones={
        esAdmin && (
          <Button
            className="min-h-11 shrink-0 px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm"
            onClick={() => {
              guardar.limpiarError();
              setEdicion('nuevo');
            }}
          >
            Agregar profesional
          </Button>
        )
      }
    >

      {empleados.error && <Alert>{empleados.error}</Alert>}
      {ratings.error && <Alert>{ratings.error}</Alert>}
      {especialidades.error && <Alert>{especialidades.error}</Alert>}
      {servicios.error && <Alert>{servicios.error}</Alert>}
      {darBaja.error && <Alert>{darBaja.error}</Alert>}

      {empleados.cargando && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${CARD_SHELL_CLASSES} flex items-center gap-4 p-4`}>
              <Skeleton className="size-14 shrink-0 rounded-full" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!empleados.cargando && !empleados.error && lista.length === 0 && (
        <EmptyState
          title={`Sin ${terminoEmpleadoPlural.toLowerCase()}`}
          description="Agregue el primero con el boton de arriba."
        />
      )}

      {!empleados.cargando && lista.length > 0 && (
        <div className="flex flex-col gap-3">{lista.map(fila)}</div>
      )}

      <EmpleadoFormModal
        abierto={edicion !== null}
        empleado={enEdicion}
        especialidades={especialidades.datos ?? []}
        servicios={servicios.datos ?? []}
        onCerrar={() => setEdicion(null)}
        onGuardar={confirmarGuardado}
        enviando={guardar.enviando}
        error={guardar.error}
      />
    </GestionLayout>
  );
}

import { useCallback, useState } from 'react';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { CARD_SHELL_CLASSES, Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Eyebrow } from '../ui/Eyebrow';
import { Skeleton } from '../ui/Skeleton';
import { RestriccionFormModal } from '../ui/RestriccionFormModal';
import { useAccionApi } from '../../hooks/useAccionApi';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { useAuth } from '../../context/AuthContext';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { formatFechaHora, yaPaso } from '../../lib/formatFechaHora';
import { nombreCompleto } from '../../lib/especialista';
import { empleadosService, type EmpleadoPublico } from '../../services/empleadosService';
import {
  restriccionesService,
  etiquetaTipo,
  type ActualizarRestriccionPayload,
  type CrearRestriccionPayload,
} from '../../services/restriccionesService';
import type { RestriccionGestion } from '../../services/restriccionesService';

/** `null` es "cerrado"; `'nuevo'` es un alta; un bloqueo es una edicion. */
type Edicion = null | 'nuevo' | RestriccionGestion;

/**
 * La seccion de dias libres: feriados, vacaciones, cierres. Autocontenida a proposito —
 * carga sus bloqueos, su selector de profesionales y su modal — para poder vivir dentro
 * de la pagina de Horarios (donde se administra la semana entera) y tambien sola en
 * `/gestion/restricciones`, sin duplicar ni una regla.
 *
 * Un EMPLEADO la ve (su agenda depende de los bloqueos) pero no escribe: el boton y las
 * acciones no se pintan, porque el API los rechazaria con 403.
 */
export function DiasLibresSeccion() {
  const { locale } = configuracionPlaceholder;
  const { rol } = useAuth();
  const esAdmin = rol === 'ADMIN';

  const [edicion, setEdicion] = useState<Edicion>(null);
  /** Sube al cambiar algo, y es la dependencia que hace que la lista se vuelva a pedir. */
  const [version, setVersion] = useState(0);

  const cargarRestricciones = useCallback(() => restriccionesService.list(), []);
  // El selector de profesional del formulario: solo los que atienden hoy, porque bloquear
  // la agenda de quien ya no atiende no hace nada.
  const cargarEmpleados = useCallback(() => empleadosService.list(), []);
  const restricciones = useRecursoApi(cargarRestricciones, [version]);
  const empleados = useRecursoApi<EmpleadoPublico[]>(cargarEmpleados, []);

  const guardar = useAccionApi((datos: CrearRestriccionPayload, id?: string) =>
    id
      ? restriccionesService.actualizar(id, datos as ActualizarRestriccionPayload)
      : restriccionesService.crear(datos),
  );
  const eliminar = useAccionApi((id: string) => restriccionesService.eliminar(id));

  const enEdicion = edicion === 'nuevo' || edicion === null ? null : edicion;

  async function confirmarGuardado(datos: CrearRestriccionPayload) {
    const resultado = await guardar.ejecutar(datos, enEdicion?.id);
    if (resultado) {
      setEdicion(null);
      setVersion((n) => n + 1);
    }
  }

  async function confirmarEliminar(restriccion: RestriccionGestion) {
    if (await eliminar.ejecutar(restriccion.id)) {
      setVersion((n) => n + 1);
    }
  }

  const lista = restricciones.datos ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Restricciones</Eyebrow>
          <h2 className="m-0 font-serif text-2xl text-text-h">Dias libres</h2>
          <p className="m-0 text-sm text-text-muted">
            Cuando cierres por un feriado o alguien se tome vacaciones, cargalo aca y
            desaparece de la agenda.
          </p>
        </div>
        {esAdmin && (
          <Button
            className="min-h-11 shrink-0 px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm"
            onClick={() => {
              guardar.limpiarError();
              setEdicion('nuevo');
            }}
          >
            Crear dia libre
          </Button>
        )}
      </div>

      {restricciones.error && <Alert>{restricciones.error}</Alert>}
      {empleados.error && <Alert>{empleados.error}</Alert>}
      {eliminar.error && <Alert>{eliminar.error}</Alert>}

      {restricciones.cargando && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className={`${CARD_SHELL_CLASSES} flex items-center gap-4 p-4`}>
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!restricciones.cargando && !restricciones.error && lista.length === 0 && (
        <EmptyState
          title="Sin dias libres cargados"
          description="Cuando cierres por un feriado o alguien se tome vacaciones, cargalo aca y desaparece de la agenda."
        />
      )}

      {!restricciones.cargando && lista.length > 0 && (
        <div className="flex flex-col gap-3">
          {lista.map((restriccion) => (
            <Card
              key={restriccion.id}
              className={`flex flex-col gap-3 sm:flex-row sm:items-center ${
                yaPaso(restriccion.fin) ? 'opacity-70' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 truncate font-medium text-text-h">
                    {etiquetaTipo(restriccion.tipo)}
                  </p>
                  {yaPaso(restriccion.fin) && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-muted">
                      Pasado
                    </span>
                  )}
                </div>
                <p className="m-0 text-sm text-text-muted">
                  {formatFechaHora(restriccion.inicio, locale)} –{' '}
                  {formatFechaHora(restriccion.fin, locale)}
                </p>
                <p className="m-0 text-sm text-text-muted">
                  {restriccion.empleado
                    ? nombreCompleto(
                        restriccion.empleado.usuario.nombre,
                        restriccion.empleado.usuario.apellido,
                      )
                    : 'Todo el negocio'}
                  {restriccion.motivo ? ` · ${restriccion.motivo}` : ''}
                </p>
              </div>

              {esAdmin && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    className="min-h-11 px-4 py-2"
                    onClick={() => {
                      guardar.limpiarError();
                      setEdicion(restriccion);
                    }}
                  >
                    Editar
                  </Button>
                  {/* Borra de verdad: la vuelta atras es volver a crearlo, y no hay
                      historico que lo cite. */}
                  <Button
                    variant="secondary"
                    className="min-h-11 px-4 py-2"
                    disabled={eliminar.enviando}
                    onClick={() => confirmarEliminar(restriccion)}
                  >
                    Eliminar
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <RestriccionFormModal
        abierto={edicion !== null}
        restriccion={enEdicion}
        empleados={empleados.datos ?? []}
        onCerrar={() => setEdicion(null)}
        onGuardar={confirmarGuardado}
        enviando={guardar.enviando}
        error={guardar.error}
      />
    </section>
  );
}

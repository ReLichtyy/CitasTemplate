import { useCallback, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { CARD_SHELL_CLASSES } from '../../components/ui/Card';
import { CitaCard } from '../../components/ui/CitaCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { CAMPO_CLASSES } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Paginacion } from '../../components/ui/Paginacion';
import { RANGO_VACIO, RangoFechas, type Rango } from '../../components/ui/RangoFechas';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { diaLocalDeISO, formatFechaLarga, limiteDelDia } from '../../lib/formatFechaHora';
import { esPersonal } from '../../lib/permisosCita';
import { nombreCompleto } from '../../lib/especialista';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { citasService } from '../../services/citasService';
import { empleadosService, type EmpleadoGestion } from '../../services/empleadosService';
import type { Cita } from '../../types/cita';

/**
 * Cuantas por pagina. Por debajo del techo del API (100) y del defecto (50): lo que se
 * repasa de una sentada es una jornada o dos, y traer cincuenta filas con sus seis
 * relaciones para mostrar diez es trabajo que nadie mira.
 */
const POR_PAGINA = 20;

/** Agrupa manteniendo el orden que trajo el API (`inicio` ascendente). */
function porDia(citas: Cita[]): { dia: string; citas: Cita[] }[] {
  const grupos: { dia: string; citas: Cita[] }[] = [];
  for (const cita of citas) {
    const dia = diaLocalDeISO(cita.inicio);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) {
      ultimo.citas.push(cita);
    } else {
      grupos.push({ dia, citas: [cita] });
    }
  }
  return grupos;
}

/**
 * Listado de citas.
 *
 * Una sola pagina para los tres roles: **el recorte lo hace el servidor**, no esta
 * pantalla. `GET /citas` aplica `filtroPorPropiedad` y devuelve las del cliente, la agenda
 * del empleado o todas si es admin. Del rol depende la presentacion (de quien se pinta el
 * nombre en cada fila) y, para el ADMIN, el filtro de profesional: es el unico que ve citas
 * ajenas a la propia agenda, y `empleadoId` es el parametro que el API le ofrece para
 * estrecharlas. Ver `03-autorizacion.md`.
 */
export function CitasListPage() {
  const { rol } = useAuth();
  const { moneda, locale } = configuracionPlaceholder;
  const esAdmin = rol === 'ADMIN';

  const [rango, setRango] = useState<Rango>(RANGO_VACIO);
  const [empleadoId, setEmpleadoId] = useState('');
  const [pagina, setPagina] = useState(0);

  // El equipo completo, no el catalogo publico: un empleado dado de baja conserva su
  // historial de citas y el ADMIN filtra tambien sobre el. La ruta es `@Roles(ADMIN)`,
  // asi que solo se pide cuando este rol es el que mira la pagina.
  const cargarEmpleados = useCallback(
    () =>
      esAdmin
        ? empleadosService.listarGestion()
        : Promise.resolve<EmpleadoGestion[]>([]),
    [esAdmin],
  );
  const {
    datos: empleados,
    cargando: cargandoEmpleados,
    error: errorEmpleados,
  } = useRecursoApi(cargarEmpleados, [esAdmin]);

  // `useRecursoApi` lee `cargar` una vez por juego de `deps`, asi que la funcion se
  // memoriza con exactamente lo que consulta y las deps repiten esos mismos valores.
  const cargar = useCallback(
    () =>
      citasService.list({
        pagina,
        limite: POR_PAGINA,
        // El API quiere instantes ISO; el input da un dia suelto. `hasta` se traduce al
        // arranque del dia siguiente porque el filtro es semiabierto: sin eso, "hasta el
        // 8" dejaria fuera todas las citas del 8.
        ...(rango.desde ? { desde: limiteDelDia(rango.desde, 'desde') } : {}),
        ...(rango.hasta ? { hasta: limiteDelDia(rango.hasta, 'hasta') } : {}),
        // Solo lo pinta el ADMIN: a un EMPLEADO el servidor ya le recorta su agenda por
        // propiedad, y el `where` combina este filtro con esa por AND.
        ...(esAdmin && empleadoId ? { empleadoId } : {}),
      }),
    [pagina, rango.desde, rango.hasta, esAdmin, empleadoId],
  );

  const { datos, cargando, error } = useRecursoApi(cargar, [
    pagina,
    rango.desde,
    rango.hasta,
    esAdmin,
    empleadoId,
  ]);

  // Cambiar el filtro reinicia la paginacion: quedarse en la pagina 3 de un rango que
  // ahora tiene una sola es una lista vacia que parece un fallo.
  const cambiarRango = (siguiente: Rango) => {
    setRango(siguiente);
    setPagina(0);
  };

  const cambiarEmpleado = (id: string) => {
    setEmpleadoId(id);
    setPagina(0);
  };

  const grupos = datos ? porDia(datos.items) : [];
  const vistaDelNegocio = esPersonal(rol);

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title="Citas"
        actions={
          <ButtonLink to="/citas/reservar" className="px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm">
            Reservar
          </ButtonLink>
        }
      />

      <div className="flex flex-col gap-2">
        <RangoFechas
          valor={rango}
          onCambiar={cambiarRango}
          onLimpiar={() => cambiarRango(RANGO_VACIO)}
          deshabilitado={cargando}
        />
        {/* El filtro de profesional es solo del ADMIN: un EMPLEADO ya recibe su propia
            agenda por propiedad y pedir la de otro no le regala nada (el servidor combina
            los dos `where` por AND). Select nativo con `CAMPO_CLASSES`, el mismo patron de
            los formularios de gestion — no hay libreria de componentes en este proyecto,
            y "Todos" es el neutro que hace de boton de limpiar. */}
        {esAdmin && (
          <label className="flex w-full max-w-80 flex-col gap-1 text-sm text-text">
            Profesional
            <select
              value={empleadoId}
              disabled={cargando || cargandoEmpleados}
              onChange={(evento) => cambiarEmpleado(evento.target.value)}
              className={CAMPO_CLASSES}
            >
              <option value="">Todos</option>
              {(empleados ?? []).map((empleado) => (
                <option key={empleado.id} value={empleado.id}>
                  {nombreCompleto(empleado.usuario.nombre, empleado.usuario.apellido)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {errorEmpleados && <Alert>{errorEmpleados}</Alert>}
      {error && <Alert>{error}</Alert>}

      {cargando && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${CARD_SHELL_CLASSES} flex flex-col gap-3 p-4 sm:p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex w-full flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-2/5" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {!cargando && !error && datos?.items.length === 0 && (
        <EmptyState
          title={
            rango.desde || rango.hasta || empleadoId ? 'Sin citas con esos filtros' : 'Todavia no hay citas'
          }
          description={
            rango.desde || rango.hasta || empleadoId
              ? 'Pruebe con otros filtros o limpielos.'
              : vistaDelNegocio
                ? 'Cuando alguien reserve, la cita aparece aqui.'
                : 'Sus reservas van a aparecer aqui.'
          }
        />
      )}

      {!cargando && datos && datos.items.length > 0 && (
        <div className="flex flex-col gap-8">
          {grupos.map(({ dia, citas }) => (
            <section key={dia} className="flex flex-col gap-3">
              {/* El dia encabeza el grupo y no se repite en cada fila. `sticky` porque una
                  jornada larga se sale de pantalla y sin esto se pierde de que dia son las
                  filas que se estan mirando. */}
              <h2 className="sticky top-16 z-10 -mx-1 bg-bg/90 px-1 py-1 text-sm font-semibold text-text-muted backdrop-blur-sm">
                {formatFechaLarga(`${dia}T00:00:00`, locale)}
              </h2>
              <div className="flex flex-col gap-3">
                {citas.map((cita) => (
                  <CitaCard
                    key={cita.id}
                    cita={cita}
                    mostrarCliente={vistaDelNegocio}
                    moneda={moneda}
                    locale={locale}
                  />
                ))}
              </div>
            </section>
          ))}

          <Paginacion
            pagina={datos.pagina}
            limite={datos.limite}
            total={datos.total}
            onCambiar={setPagina}
            deshabilitado={cargando}
          />
        </div>
      )}
    </div>
  );
}

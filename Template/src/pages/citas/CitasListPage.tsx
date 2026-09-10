import { useCallback, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { CARD_SHELL_CLASSES } from '../../components/ui/Card';
import { CitaCard } from '../../components/ui/CitaCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Paginacion } from '../../components/ui/Paginacion';
import { RANGO_VACIO, RangoFechas, type Rango } from '../../components/ui/RangoFechas';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { diaLocalDeISO, formatFechaLarga, limiteDelDia } from '../../lib/formatFechaHora';
import { esPersonal } from '../../lib/permisosCita';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { citasService } from '../../services/citasService';
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
 * del empleado o todas si es admin. Aqui lo unico que cambia con el rol es de quien se
 * pinta el nombre en cada fila, que es presentacion. Ver `03-autorizacion.md`.
 */
export function CitasListPage() {
  const { rol } = useAuth();
  const { moneda, locale } = configuracionPlaceholder;

  const [rango, setRango] = useState<Rango>(RANGO_VACIO);
  const [pagina, setPagina] = useState(0);

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
      }),
    [pagina, rango.desde, rango.hasta],
  );

  const { datos, cargando, error } = useRecursoApi(cargar, [pagina, rango.desde, rango.hasta]);

  // Cambiar el filtro reinicia la paginacion: quedarse en la pagina 3 de un rango que
  // ahora tiene una sola es una lista vacia que parece un fallo.
  const cambiarRango = (siguiente: Rango) => {
    setRango(siguiente);
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

      <RangoFechas
        valor={rango}
        onCambiar={cambiarRango}
        onLimpiar={() => cambiarRango(RANGO_VACIO)}
        deshabilitado={cargando}
      />

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
          title={rango.desde || rango.hasta ? 'Sin citas en ese rango' : 'Todavia no hay citas'}
          description={
            rango.desde || rango.hasta
              ? 'Pruebe con otras fechas o limpie el filtro.'
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

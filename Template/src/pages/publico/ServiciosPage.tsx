import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { EmptyState } from '../../components/ui/EmptyState';
import { ServicioCard } from '../../components/ui/ServicioCard';
import { Spinner } from '../../components/ui/Spinner';
import { Thumbnail } from '../../components/ui/Thumbnail';
import { Modal } from '../../components/ui/Modal';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { iniciales, nombreCompleto } from '../../lib/especialista';
import { formatDuration } from '../../lib/formatDuration';
import { formatPrice } from '../../lib/formatPrice';
import { serviciosService, type ServicioPublico } from '../../services/serviciosService';

const GRID_CLASSES = 'stagger-in grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3';

/**
 * Catalogo publico completo. Es una pagina distinta de
 * `gestion/servicios/ServiciosListPage`, que es la vista de administracion del mismo
 * dominio: misma tabla, audiencias y permisos distintos.
 *
 * Se diferencia de la seccion de servicios de `/equipo` en una cosa, y esa cosa es la
 * razon de que exista: aqui el detalle dice **quien realiza** cada servicio, que es lo que
 * convierte el catalogo en el primer paso de una reserva.
 */
export function ServiciosPage() {
  const { moneda, locale, terminoServicioPlural, terminoEmpleadoPlural } =
    configuracionPlaceholder;
  const [elegido, setElegido] = useState<ServicioPublico | null>(null);
  const { datos, cargando, error } = useRecursoApi(() => serviciosService.list());

  const servicios = datos ?? [];

  return (
    <main className="flex flex-col gap-8 py-6 sm:gap-10 sm:py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {terminoServicioPlural}
        </h1>
        <span className="h-px w-12 bg-accent/60" aria-hidden="true" />
        <p className="max-w-prose text-sm text-text">
          Elija lo que necesita y vea quien lo realiza. La duracion y el precio son los que
          se cobran al agendar.
        </p>
      </header>

      {cargando && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {!cargando && error && <Alert>{error}</Alert>}
      {!cargando && !error && servicios.length === 0 && (
        <EmptyState
          title={`Todavia no hay ${terminoServicioPlural.toLowerCase()} publicados.`}
          description="Vuelva a intentarlo mas tarde."
        />
      )}

      {!cargando && !error && servicios.length > 0 && (
        <div className={GRID_CLASSES}>
          {servicios.map((servicio) => (
            <ServicioCard
              key={servicio.id}
              servicio={servicio}
              moneda={moneda}
              locale={locale}
              onSelect={() => setElegido(servicio)}
            />
          ))}
        </div>
      )}

      <Modal open={elegido !== null} onClose={() => setElegido(null)} titulo={elegido?.nombre ?? ''}>
        {elegido && (
          <div className="flex flex-col gap-4">
            {elegido.imagenUrl && (
              <img
                src={elegido.imagenUrl}
                alt=""
                className="h-32 w-full rounded-lg bg-accent-bg object-cover sm:h-40"
              />
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="whitespace-nowrap text-sm text-text-muted">
                {formatDuration(elegido.duracionMinutos)}
              </span>
              <span className="text-xl font-bold tabular-nums text-price">
                {formatPrice(elegido.precio, moneda, locale)}
              </span>
            </div>
            {elegido.descripcion && (
              <p className="text-sm leading-relaxed">{elegido.descripcion}</p>
            )}

            {/* Quien lo realiza. Un servicio sin nadie asignado no se puede reservar, asi
                que la lista vacia se dice, no se omite. */}
            <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
              <h3 className="text-sm font-semibold tracking-tight text-text-h">
                {terminoEmpleadoPlural}
              </h3>
              {elegido.empleados.length === 0 ? (
                <p className="text-sm text-text-muted">
                  Sin personal asignado por ahora. Escriba al negocio para coordinarlo.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {elegido.empleados.map((empleado) => (
                    <li key={empleado.id} className="flex items-center gap-2.5">
                      <Thumbnail
                        src={empleado.fotoUrl}
                        fallback={iniciales(empleado.usuario.nombre, empleado.usuario.apellido)}
                        className="h-9 w-9 rounded-full text-xs"
                      />
                      <span className="text-sm text-text-h">
                        {nombreCompleto(empleado.usuario.nombre, empleado.usuario.apellido)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ButtonLink to="/citas/reservar" className="w-full">
              Agendar Cita
            </ButtonLink>
          </div>
        )}
      </Modal>
    </main>
  );
}

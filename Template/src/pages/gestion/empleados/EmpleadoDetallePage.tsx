import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Card, CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StarIcon } from '../../../components/ui/StarIcon';
import { Thumbnail } from '../../../components/ui/Thumbnail';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { iniciales, nombreCompleto } from '../../../lib/especialista';
import { formatFecha } from '../../../lib/formatFecha';
import { formatPrice } from '../../../lib/formatPrice';
import { formatDuration } from '../../../lib/formatDuration';
import { empleadosService } from '../../../services/empleadosService';

export function EmpleadoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { moneda, locale } = configuracionPlaceholder;
  const { datos: empleado, cargando, error } = useRecursoApi(() => empleadosService.get(id!), [id]);

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title="Detalle de empleado"
        actions={
          <Link to="/gestion/empleados" className="text-sm text-text hover:text-text-h">
            Volver
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}

      {cargando && (
        <div className={`${CARD_SHELL_CLASSES} flex items-center gap-4 p-4 sm:p-6`}>
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="flex w-full flex-col gap-2">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
      )}

      {!cargando && !error && empleado && (
        <Card className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Thumbnail
              src={empleado.fotoUrl}
              fallback={iniciales(empleado.usuario.nombre, empleado.usuario.apellido)}
              className="size-16 rounded-full text-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-xl font-semibold text-text-h">
                {nombreCompleto(empleado.usuario.nombre, empleado.usuario.apellido)}
              </p>
              {empleado.especialidad && (
                <p className="m-0 text-sm font-medium text-text-muted">
                  {empleado.especialidad.nombre}
                </p>
              )}
            </div>
          </div>

          {empleado.bio && <p className="text-sm leading-relaxed">{empleado.bio}</p>}

          <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
            <h2 className="text-sm font-semibold tracking-tight text-text-h">Servicios que realiza</h2>
            {empleado.servicios.length === 0 ? (
              <p className="text-sm text-text-muted">Sin servicios asignados por ahora.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {empleado.servicios.map((servicio) => (
                  <li key={servicio.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-text-h">{servicio.nombre}</span>
                    <span className="shrink-0 text-text-muted">
                      {formatDuration(servicio.duracionMinutos)} ·{' '}
                      <span className="font-medium tabular-nums text-price">
                        {formatPrice(servicio.precio, moneda, locale)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {empleado.rating && (
            <div className="flex flex-col gap-4 border-t border-border/70 pt-4">
              <div className="flex items-center gap-2.5">
                <StarIcon className="h-7 w-7 shrink-0 text-price" />
                <p className="text-3xl leading-none font-bold tracking-tight tabular-nums text-text-h">
                  {empleado.rating.promedio.toFixed(1)}
                </p>
                <p className="self-end text-xs text-text-muted">{empleado.rating.total} resenas</p>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold tracking-tight text-text-h">Ultimas resenas</h3>
                {empleado.rating.ultimasResenas.slice(0, 3).map((resena) => (
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
        </Card>
      )}
    </div>
  );
}

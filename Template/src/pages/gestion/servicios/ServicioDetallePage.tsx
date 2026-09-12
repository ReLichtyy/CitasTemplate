import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Card, CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Thumbnail } from '../../../components/ui/Thumbnail';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { formatDuration } from '../../../lib/formatDuration';
import { formatPrice } from '../../../lib/formatPrice';
import { iniciales, nombreCompleto } from '../../../lib/especialista';
import { serviciosService } from '../../../services/serviciosService';

export function ServicioDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { moneda, locale } = configuracionPlaceholder;
  const { datos: servicio, cargando, error } = useRecursoApi(() => serviciosService.get(id!), [id]);

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title="Detalle de servicio"
        actions={
          <Link to="/gestion/servicios" className="text-sm text-text hover:text-text-h">
            Volver
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}

      {cargando && (
        <div className={`${CARD_SHELL_CLASSES} flex flex-col gap-4 p-4 sm:p-6`}>
          <Skeleton className="aspect-4/3 w-full rounded-lg" />
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      )}

      {!cargando && !error && servicio && (
        <Card className="flex flex-col gap-4">
          {servicio.imagenUrl && (
            <Thumbnail
              src={servicio.imagenUrl}
              fallback={servicio.nombre.charAt(0).toUpperCase()}
              className="aspect-4/3 w-full rounded-lg text-5xl"
            />
          )}

          <div className="flex flex-col gap-1">
            <p className="m-0 text-xl font-semibold text-text-h">{servicio.nombre}</p>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="text-text-muted">{formatDuration(servicio.duracionMinutos)}</span>
              <span aria-hidden="true" className="text-border">
                ·
              </span>
              <span className="font-medium tabular-nums text-price">
                {formatPrice(servicio.precio, moneda, locale)}
              </span>
            </div>
          </div>

          {servicio.descripcion && (
            <p className="text-sm leading-relaxed text-text">{servicio.descripcion}</p>
          )}

          <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
            <h2 className="text-sm font-semibold tracking-tight text-text-h">Lo realizan</h2>
            {servicio.empleados.length === 0 ? (
              <p className="text-sm text-text-muted">Sin personal asignado por ahora.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {servicio.empleados.map((empleado) => (
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
        </Card>
      )}
    </div>
  );
}

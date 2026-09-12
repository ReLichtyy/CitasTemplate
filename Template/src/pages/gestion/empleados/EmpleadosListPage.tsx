import { Link } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { CARD_INTERACTIVE_CLASSES, CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { CardDetailIcon } from '../../../components/ui/CardDetailIcon';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StarIcon } from '../../../components/ui/StarIcon';
import { Thumbnail } from '../../../components/ui/Thumbnail';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { iniciales, nombreCompleto } from '../../../lib/especialista';
import { empleadosService } from '../../../services/empleadosService';

/**
 * Listado de gestion, solo lectura: `GET /empleados` ya trae la ficha completa, pero
 * `POST`/`PATCH`/`DELETE` todavia tiran `NotImplementedException` en el API. Cuando el
 * backend los implemente, esta pantalla suma alta y edicion, igual que
 * `gestion/productos/ProductosListPage`.
 */
export function EmpleadosListPage() {
  const { terminoEmpleadoPlural } = configuracionPlaceholder;
  const { datos, cargando, error } = useRecursoApi(() => empleadosService.list());

  const empleados = datos ?? [];

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader title={terminoEmpleadoPlural} />

      {error && <Alert>{error}</Alert>}

      {cargando && (
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

      {!cargando && !error && empleados.length === 0 && (
        <EmptyState
          title={`Sin ${terminoEmpleadoPlural.toLowerCase()}`}
          description="Todavia no hay empleados registrados."
        />
      )}

      {!cargando && !error && empleados.length > 0 && (
        <div className="flex flex-col gap-3">
          {empleados.map((empleado) => (
            <Link key={empleado.id} to={`/gestion/empleados/${empleado.id}`} className="no-underline">
              <div className={`${CARD_INTERACTIVE_CLASSES} flex items-center gap-4`}>
                <Thumbnail
                  src={empleado.fotoUrl}
                  fallback={iniciales(empleado.usuario.nombre, empleado.usuario.apellido)}
                  className="size-14 rounded-full text-lg"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="m-0 truncate font-medium text-text-h">
                    {nombreCompleto(empleado.usuario.nombre, empleado.usuario.apellido)}
                  </p>
                  {empleado.especialidad && (
                    <p className="m-0 truncate text-sm text-text-muted">
                      {empleado.especialidad.nombre}
                    </p>
                  )}
                </div>
                {empleado.rating && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-text-h">
                    <StarIcon className="h-3.5 w-3.5 text-price" />
                    <span className="tabular-nums">{empleado.rating.promedio.toFixed(1)}</span>
                  </span>
                )}
                <CardDetailIcon />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { CARD_INTERACTIVE_CLASSES, CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { CardDetailIcon } from '../../../components/ui/CardDetailIcon';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Thumbnail } from '../../../components/ui/Thumbnail';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { formatDuration } from '../../../lib/formatDuration';
import { formatPrice } from '../../../lib/formatPrice';
import { serviciosService } from '../../../services/serviciosService';

/**
 * Listado de gestion. Solo lectura por ahora: `POST`/`PATCH`/`DELETE` de `/servicios`
 * todavia tiran `NotImplementedException` en el API, asi que un formulario de alta o
 * edicion aqui se rompiria al guardar. Cuando el backend los implemente, esta pantalla
 * suma el boton "Agregar servicio" y las acciones por fila, igual que ya hace
 * `gestion/productos/ProductosListPage`.
 */
export function ServiciosListPage() {
  const { moneda, locale, terminoServicioPlural } = configuracionPlaceholder;
  const { datos, cargando, error } = useRecursoApi(() => serviciosService.list());

  const servicios = datos ?? [];

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader title={terminoServicioPlural} />

      {error && <Alert>{error}</Alert>}

      {cargando && (
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

      {!cargando && !error && servicios.length === 0 && (
        <EmptyState
          title={`Sin ${terminoServicioPlural.toLowerCase()}`}
          description="Todavia no hay servicios registrados."
        />
      )}

      {!cargando && !error && servicios.length > 0 && (
        <div className="flex flex-col gap-3">
          {servicios.map((servicio) => (
            <Link key={servicio.id} to={`/gestion/servicios/${servicio.id}`} className="no-underline">
              <div className={`${CARD_INTERACTIVE_CLASSES} flex items-center gap-4`}>
                <Thumbnail
                  src={servicio.imagenUrl}
                  fallback={servicio.nombre.charAt(0).toUpperCase()}
                  className="size-14 rounded-lg text-xl"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="m-0 truncate font-medium text-text-h">{servicio.nombre}</p>
                  <p className="m-0 text-sm text-text-muted">
                    {formatDuration(servicio.duracionMinutos)} ·{' '}
                    <span className="font-medium tabular-nums text-price">
                      {formatPrice(servicio.precio, moneda, locale)}
                    </span>
                  </p>
                </div>
                <CardDetailIcon />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

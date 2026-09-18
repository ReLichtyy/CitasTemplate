import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Card, CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { formatPrice } from '../../../lib/formatPrice';
import { adicionalesService } from '../../../services/adicionalesService';

/**
 * La ficha de un adicional: lo mismo que la lista, abierto. Es a donde se llega cuando se
 * quiere ver la descripcion entera sin abrir el formulario de edicion.
 */
export function AdicionalDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { moneda, locale } = configuracionPlaceholder;
  const { datos: adicional, cargando, error } = useRecursoApi(
    () => adicionalesService.get(id!),
    [id],
  );

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title="Detalle de adicional"
        actions={
          <Link to="/gestion/adicionales" className="text-sm text-text hover:text-text-h">
            Volver
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}

      {cargando && (
        <div className={`${CARD_SHELL_CLASSES} flex flex-col gap-3 p-4 sm:p-6`}>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      )}

      {!cargando && !error && adicional && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-xl font-semibold text-text-h">{adicional.nombre}</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                adicional.activo
                  ? 'border-success-border text-success'
                  : 'border-border text-text-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${adicional.activo ? 'bg-success' : 'bg-text-muted'}`}
              />
              {adicional.activo ? 'Disponible' : 'Sin ofrecer'}
            </span>
          </div>

          <p className="m-0 font-medium tabular-nums text-price">
            {formatPrice(adicional.precio, moneda, locale)}
          </p>

          {adicional.descripcion && (
            <p className="text-sm leading-relaxed text-text">{adicional.descripcion}</p>
          )}
        </Card>
      )}
    </div>
  );
}

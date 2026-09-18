import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Card, CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../../lib/configuracionPlaceholder';
import { formatFechaHora, yaPaso } from '../../../lib/formatFechaHora';
import { nombreCompleto } from '../../../lib/especialista';
import { etiquetaTipo, restriccionesService } from '../../../services/restriccionesService';

/**
 * La ficha de un bloqueo: tipo, rango, a quien alcanza y por que. El "a quien" es lo que
 * la lista no muestra entero — aqui se lee si el bloqueo es de un profesional o del
 * negocio completo.
 */
export function RestriccionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = configuracionPlaceholder;
  const { datos: restriccion, cargando, error } = useRecursoApi(
    () => restriccionesService.get(id!),
    [id],
  );

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title="Detalle de restriccion"
        actions={
          <Link to="/gestion/restricciones" className="text-sm text-text hover:text-text-h">
            Volver
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}

      {cargando && (
        <div className={`${CARD_SHELL_CLASSES} flex flex-col gap-3 p-4 sm:p-6`}>
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      )}

      {!cargando && !error && restriccion && (
        <Card className={`flex flex-col gap-4 ${yaPaso(restriccion.fin) ? 'opacity-70' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-xl font-semibold text-text-h">
              {etiquetaTipo(restriccion.tipo)}
            </p>
            {yaPaso(restriccion.fin) && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-muted">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-text-muted" />
                Pasado
              </span>
            )}
          </div>

          <p className="m-0 tabular-nums text-text">
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
          </p>

          {restriccion.motivo && (
            <p className="text-sm leading-relaxed text-text">{restriccion.motivo}</p>
          )}
        </Card>
      )}
    </div>
  );
}

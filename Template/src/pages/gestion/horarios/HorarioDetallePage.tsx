import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Card, CARD_SHELL_CLASSES } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useRecursoApi } from '../../../hooks/useRecursoApi';
import { aHoraPared, etiquetaDia, horariosService } from '../../../services/horariosService';

/**
 * La ficha de una franja de atencion: dia, rango y estado. Sencilla a proposito — una
 * franja son dos horas y un interruptor, y la pantalla que la administra es la lista.
 */
export function HorarioDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { datos: horario, cargando, error } = useRecursoApi(
    () => horariosService.get(id!),
    [id],
  );

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title="Detalle de horario"
        actions={
          <Link to="/gestion/horarios" className="text-sm text-text hover:text-text-h">
            Volver
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}

      {cargando && (
        <div className={`${CARD_SHELL_CLASSES} flex flex-col gap-3 p-4 sm:p-6`}>
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      )}

      {!cargando && !error && horario && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-xl font-semibold text-text-h">{etiquetaDia(horario.dia)}</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                horario.activo
                  ? 'border-success-border text-success'
                  : 'border-border text-text-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${horario.activo ? 'bg-success' : 'bg-text-muted'}`}
              />
              {horario.activo ? 'Atiende' : 'En pausa'}
            </span>
          </div>

          <p className="m-0 text-lg tabular-nums text-text-h">
            {aHoraPared(horario.minutoApertura)} – {aHoraPared(horario.minutoCierre)}
          </p>
        </Card>
      )}
    </div>
  );
}

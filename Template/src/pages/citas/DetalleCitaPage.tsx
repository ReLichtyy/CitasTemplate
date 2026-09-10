import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { Card } from '../../components/ui/Card';
import { DatoFicha } from '../../components/ui/DatoFicha';
import { DesgloseCosto } from '../../components/ui/DesgloseCosto';
import { DialogoCancelar } from '../../components/ui/DialogoCancelar';
import { EstadoBadge } from '../../components/ui/EstadoBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { useAccionApi } from '../../hooks/useAccionApi';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { formatDuration } from '../../lib/formatDuration';
import { formatFechaHora, formatFechaLarga, formatRangoHoras } from '../../lib/formatFechaHora';
import { motivoSinCancelar, puedeCancelar, puedeEditar } from '../../lib/permisosCita';
import { citasService } from '../../services/citasService';
import type { Cita, UsuarioResumen } from '../../types/cita';

function nombreCompleto(usuario: UsuarioResumen): string {
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ');
}

/**
 * Ficha de una cita.
 *
 * Quien puede abrirla lo decide `PropiedadCitaGuard` en el servidor, no esta pagina: un id
 * ajeno devuelve el mismo "Recurso no encontrado" que uno inexistente, a proposito, para
 * que la ruta no sirva de oraculo de ids. Aqui ese texto se muestra tal cual.
 *
 * Los botones se pintan segun los indicadores que trae `cita.estado`, no segun una lista
 * de codigos escrita aqui. Ver `lib/permisosCita`.
 */
export function DetalleCitaPage() {
  const { id } = useParams<{ id: string }>();
  const { rol } = useAuth();
  const navigate = useNavigate();
  const { moneda, locale } = configuracionPlaceholder;

  const [confirmando, setConfirmando] = useState(false);
  /** La cita cancelada que devuelve el API reemplaza a la cargada, sin volver a pedirla. */
  const [cancelada, setCancelada] = useState<Cita | null>(null);

  const cargar = useCallback(() => citasService.get(id ?? ''), [id]);
  const { datos, cargando, error } = useRecursoApi(cargar, [id]);

  const cancelar = useAccionApi((motivo?: string) => citasService.cancelar(id ?? '', motivo));

  const cita = cancelada ?? datos;

  async function confirmarCancelacion(motivo?: string) {
    const resultado = await cancelar.ejecutar(motivo);
    if (resultado) {
      // No se navega: la ficha sigue siendo la respuesta a "que paso con mi cita", ahora
      // con el estado nuevo y su motivo. Irse al listado obligaria a volver a buscarla.
      setCancelada(resultado);
      setConfirmando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <Skeleton className="h-9 w-56" />
        <Card className="flex flex-col gap-4">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </Card>
      </div>
    );
  }

  if (error || !cita) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <PageHeader title="Cita" />
        <Alert>{error ?? 'Recurso no encontrado.'}</Alert>
        <ButtonLink to="/citas" variant="secondary" className="self-start">
          Volver a las citas
        </ButtonLink>
      </div>
    );
  }

  const sinCancelar = motivoSinCancelar(cita, rol);
  const editable = puedeEditar(cita, rol);

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title={cita.servicio.nombre}
        actions={
          <Link to="/citas" className="shrink-0 text-sm text-text hover:text-text-h">
            Volver
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <time dateTime={cita.inicio} className="text-lg font-semibold text-text-h">
                {formatRangoHoras(cita.inicio, cita.fin, locale)}
              </time>
              <p className="m-0 text-sm text-text">{formatFechaLarga(cita.inicio, locale)}</p>
            </div>
            <EstadoBadge estado={cita.estado} />
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatoFicha etiqueta="Atiende">{nombreCompleto(cita.empleado.usuario)}</DatoFicha>
            <DatoFicha etiqueta="Duracion">
              {formatDuration(cita.servicio.duracionMinutos)}
            </DatoFicha>
            <DatoFicha etiqueta="Cliente">{nombreCompleto(cita.cliente)}</DatoFicha>
            <DatoFicha etiqueta="Telefono">
              {/* Enlace tel:: en movil es el numero al que se llama cuando alguien no
                  llega, y es el uso real de este dato en una agenda. */}
              <a href={`tel:${cita.cliente.telefono}`} className="text-accent">
                {cita.cliente.telefono}
              </a>
            </DatoFicha>
            {cita.cliente.email && (
              <DatoFicha etiqueta="Correo">{cita.cliente.email}</DatoFicha>
            )}
            {/* Solo cuando difieren: en una reserva propia repetir el nombre no dice nada. */}
            {cita.registradaPorId !== cita.clienteId && (
              <DatoFicha etiqueta="Registrada por">
                {nombreCompleto(cita.registradaPor)}
              </DatoFicha>
            )}
            {cita.notas && (
              <DatoFicha etiqueta="Notas" ancho>
                <span className="whitespace-pre-line">{cita.notas}</span>
              </DatoFicha>
            )}
            {cita.motivoCancelacion && (
              <DatoFicha etiqueta="Motivo de la cancelacion" ancho>
                {cita.motivoCancelacion}
              </DatoFicha>
            )}
          </dl>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-base">Costo</h2>
          <DesgloseCosto cita={cita} moneda={moneda} locale={locale} />
        </Card>
      </div>

      {/* El error de cancelacion tambien se muestra fuera del dialogo: si el dialogo se
          cerro y la peticion fallo despues, el mensaje no puede quedarse sin dueno. */}
      {cancelar.error && !confirmando && <Alert>{cancelar.error}</Alert>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {editable && (
          <Button onClick={() => navigate(`/citas/${cita.id}/editar`)}>Reprogramar</Button>
        )}
        {puedeCancelar(cita, rol) ? (
          <Button
            variant="secondary"
            onClick={() => {
              cancelar.limpiarError();
              setConfirmando(true);
            }}
          >
            Cancelar cita
          </Button>
        ) : (
          // Se explica por que no se puede, en vez de dejar un hueco donde habia un boton.
          <p className="m-0 text-sm text-text-muted">{sinCancelar}</p>
        )}
      </div>

      <p className="m-0 text-xs text-text-muted">
        Reservada el {formatFechaHora(cita.creadaEn, locale)}.
      </p>

      <DialogoCancelar
        cita={cita}
        abierto={confirmando}
        onCerrar={() => setConfirmando(false)}
        onConfirmar={confirmarCancelacion}
        enviando={cancelar.enviando}
        error={cancelar.error}
        locale={locale}
      />
    </div>
  );
}

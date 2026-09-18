import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { CARD_SHELL_CLASSES, Card } from '../../components/ui/Card';
import { DialogoCancelar } from '../../components/ui/DialogoCancelar';
import { EmptyState } from '../../components/ui/EmptyState';
import { EstadoBadge } from '../../components/ui/EstadoBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { GestionLayout } from '../../components/gestion/GestionLayout';
import { useAccionApi } from '../../hooks/useAccionApi';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { useAuth } from '../../context/AuthContext';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { formatHora, limiteDelDia, yaPaso } from '../../lib/formatFechaHora';
import { nombreCompleto } from '../../lib/especialista';
import { puedeCancelar, puedeEditar } from '../../lib/permisosCita';
import type { Rol } from '../../services/authService';
import { citasService } from '../../services/citasService';
import { empleadosService, type EmpleadoPublico } from '../../services/empleadosService';
import type { Cita } from '../../types/cita';

/** Un dia como `YYYY-MM-DD`, la forma del `<input type="date">`. */
const HOY = () => {
  const fecha = new Date();
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

/** Un dia corrido n veces: los accesos de la agenda no calculan fechas a mano. */
function correrDia(dia: string, dias: number): string {
  const [anio, mes, diaDelMes] = dia.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, diaDelMes + dias);
  const mesDos = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const diaDos = `${fecha.getDate()}`.padStart(2, '0');
  return `${fecha.getFullYear()}-${mesDos}-${diaDos}`;
}

/**
 * El turno en la agenda: hora, cliente, servicio, profesional y estado, con las acciones
 * rapidas del personal. La cita completa vive en su ficha; aqui se atiende el dia, no se
 * edita la reserva.
 */
function Turno({
  cita,
  esAdmin,
  rol,
  locale,
  enviando,
  onConfirmar,
  onAtender,
  onCancelar,
}: {
  cita: Cita;
  esAdmin: boolean;
  rol: Rol | null;
  locale: string;
  enviando: boolean;
  onConfirmar: (cita: Cita) => void;
  onAtender: (cita: Cita) => void;
  onCancelar: (cita: Cita) => void;
}) {
  const editable = puedeEditar(cita, rol);

  return (
    <Card
      className={`flex flex-col gap-3 sm:flex-row sm:items-center ${yaPaso(cita.fin) ? 'opacity-70' : ''}`}
    >
      <p className="m-0 w-16 shrink-0 text-lg font-semibold tabular-nums text-text-h">
        {formatHora(cita.inicio, locale)}
      </p>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="m-0 truncate font-medium text-text-h">
            {nombreCompleto(cita.cliente.nombre, cita.cliente.apellido)}
          </p>
          <EstadoBadge estado={cita.estado} />
        </div>
        <p className="m-0 truncate text-sm text-text-muted">
          {cita.servicio.nombre}
          {esAdmin && ` · ${nombreCompleto(cita.empleado.usuario.nombre, cita.empleado.usuario.apellido)}`}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {/* Que se puede hacer lo dice el estado que viaja en la cita, no esta pagina:
            `permiteEdicion` y `permiteCancelacionPersonal`. Un 403 o un 409 del servidor
            siguen siendo posibles — otra pestana pudo mover la cita primero. */}
        {editable && (
          <Button
            variant="secondary"
            className="min-h-11 px-4 py-2"
            disabled={enviando}
            onClick={() => onConfirmar(cita)}
          >
            Confirmar
          </Button>
        )}
        {editable && (
          <Button
            variant="secondary"
            className="min-h-11 px-4 py-2"
            disabled={enviando}
            onClick={() => onAtender(cita)}
          >
            Atendida
          </Button>
        )}
        {puedeCancelar(cita, rol) && (
          <Button
            variant="secondary"
            className="min-h-11 px-4 py-2"
            disabled={enviando}
            onClick={() => onCancelar(cita)}
          >
            Cancelar
          </Button>
        )}
        <Link
          to={`/citas/${cita.id}`}
          className="inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold text-text hover:text-text-h"
        >
          Ficha
        </Link>
      </div>
    </Card>
  );
}

/**
 * La agenda del dia: el turno de trabajo del personal.
 *
 * Se lista un dia por vez, en orden cronologico, con las acciones rapidas que se hacen
 * atendiendo la puerta —confirmar, marcar atendida, cancelar— y el enlace a la ficha para
 * lo demas. Un ADMIN ve toda la agenda y puede seguirla por profesional; un EMPLEADO
 * recibe la suya del servidor, sin filtro ni botones para pedir la de otro.
 */
export function AgendaPage() {
  const { locale, terminoEmpleadoPlural } = configuracionPlaceholder;
  const { rol } = useAuth();
  const esAdmin = rol === 'ADMIN';

  const [dia, setDia] = useState(HOY);
  /** Sube al cambiar algo, y es la dependencia que hace que el dia se vuelva a pedir. */
  const [version, setVersion] = useState(0);
  /** Vacia = todos los profesionales. Solo se ofrece al ADMIN. */
  const [empleadoId, setEmpleadoId] = useState('');
  const [porCancelar, setPorCancelar] = useState<Cita | null>(null);

  const cargarCitas = useCallback(
    () =>
      citasService.list({
        // El dia completo, semiabierto como el API: `desde` inclusive, `hasta` al dia
        // siguiente. Un dia no pasa de 100 citas; el techo del API es el mismo.
        desde: limiteDelDia(dia, 'desde'),
        hasta: limiteDelDia(dia, 'hasta'),
        limite: 100,
        ...(empleadoId ? { empleadoId } : {}),
      }),
    [dia, empleadoId],
  );
  const citas = useRecursoApi(cargarCitas, [dia, empleadoId, version]);

  const cargarEmpleados = useCallback(() => empleadosService.list(), []);
  const empleados = useRecursoApi<EmpleadoPublico[]>(cargarEmpleados, []);

  const cambiarEstado = useAccionApi((id: string, estadoCodigo: string) =>
    citasService.update(id, { estadoCodigo }),
  );
  const cancelar = useAccionApi((id: string, motivo?: string) =>
    citasService.cancelar(id, motivo),
  );

  const lista = useMemo(() => citas.datos?.items ?? [], [citas.datos]);

  async function confirmarEstado(cita: Cita, estadoCodigo: string) {
    const resultado = await cambiarEstado.ejecutar(cita.id, estadoCodigo);
    if (resultado) {
      // Se vuelve a pedir el dia entero: el orden cronologico y el estado los decide el
      // API, y la fila ya movida no se reconstruye en memoria.
      setVersion((n) => n + 1);
    }
  }

  return (
    <GestionLayout pestana="agenda" titulo="Agenda">

      {/* El dia y el profesional: dos preguntas distintas, en una sola barra. El ADMIN
          ademas filtra por profesional; al EMPLEADO no se le ofrece porque su agenda ya
          es la propia y no hay otra que pedir. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          className="min-h-11 px-4 py-2"
          onClick={() => setDia((actual) => correrDia(actual, -1))}
        >
          Anterior
        </Button>
        <input
          type="date"
          value={dia}
          onChange={(evento) => setDia(evento.target.value || HOY())}
          className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base text-text-h md:text-sm hover:border-accent-border focus-visible:border-accent-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border"
        />
        <Button
          variant="secondary"
          className="min-h-11 px-4 py-2"
          onClick={() => setDia((actual) => correrDia(actual, 1))}
        >
          Siguiente
        </Button>
        <Button
          variant="secondary"
          className="min-h-11 px-4 py-2"
          onClick={() => setDia(HOY())}
        >
          Hoy
        </Button>

        {esAdmin && (
          <label className="ml-auto flex items-center gap-2 text-sm text-text">
            {terminoEmpleadoPlural}
            <select
              value={empleadoId}
              onChange={(evento) => setEmpleadoId(evento.target.value)}
              className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base text-text-h md:text-sm hover:border-accent-border focus-visible:border-accent-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border"
            >
              <option value="">Todos</option>
              {(empleados.datos ?? []).map((empleado) => (
                <option key={empleado.id} value={empleado.id}>
                  {nombreCompleto(empleado.usuario.nombre, empleado.usuario.apellido)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {citas.error && <Alert>{citas.error}</Alert>}
      {cambiarEstado.error && <Alert>{cambiarEstado.error}</Alert>}
      {cancelar.error && <Alert>{cancelar.error}</Alert>}

      {citas.cargando && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`${CARD_SHELL_CLASSES} flex items-center gap-4 p-4`}>
              <Skeleton className="h-6 w-14 shrink-0" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!citas.cargando && !citas.error && lista.length === 0 && (
        <EmptyState
          title="Sin citas este dia"
          description="Pruebe otro dia con los botones de arriba."
        />
      )}

      {!citas.cargando && lista.length > 0 && (
        <div className="flex flex-col gap-3">
          {lista.map((cita) => (
            <Turno
              key={cita.id}
              cita={cita}
              esAdmin={esAdmin}
              rol={rol}
              locale={locale}
              enviando={cambiarEstado.enviando || cancelar.enviando}
              onConfirmar={(c) => confirmarEstado(c, 'CONFIRMADA')}
              onAtender={(c) => confirmarEstado(c, 'ATENDIDA')}
              onCancelar={() => setPorCancelar(cita)}
            />
          ))}
        </div>
      )}

      {porCancelar && (
        <DialogoCancelar
          cita={porCancelar}
          abierto
          onCerrar={() => setPorCancelar(null)}
          onConfirmar={async (motivo) => {
            const resultado = await cancelar.ejecutar(porCancelar.id, motivo);
            if (resultado) {
              setPorCancelar(null);
              setVersion((n) => n + 1);
            }
          }}
          enviando={cancelar.enviando}
          error={cancelar.error}
          locale={locale}
        />
      )}
    </GestionLayout>
  );
}

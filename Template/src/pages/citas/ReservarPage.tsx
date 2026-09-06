import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { Card, CARD_BASE_CLASSES } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Spinner } from '../../components/ui/Spinner';
import { useAuth } from '../../context/AuthContext';
import { authService, type UsuarioActual } from '../../services/authService';
import { citasService, type CitaReservada, type Disponibilidad } from '../../services/citasService';
import {
  empleadosService,
  type EmpleadoPublico,
  type ServicioDeEmpleado,
} from '../../services/empleadosService';

const CAMPO_CLASSES =
  'min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text-h transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border';

const OPCION_CLASSES = `${CARD_BASE_CLASSES} w-full text-left transition duration-200 hover:border-accent-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border`;
const OPCION_ELEGIDA_CLASSES = 'border-accent-border bg-accent-bg';

// TODO: moneda y locale salen de ConfiguracionNegocio; falta el endpoint publico
// /configuracion. Hasta entonces se formatea el numero sin simbolo. Ver 05-marca-y-responsive.md.
const formatoPrecio = new Intl.NumberFormat('es', { minimumFractionDigits: 2 });

function hoyEnISO(): string {
  const hoy = new Date();
  const mes = `${hoy.getMonth() + 1}`.padStart(2, '0');
  const dia = `${hoy.getDate()}`.padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function nombreCompleto(usuario: { nombre: string; apellido: string | null }): string {
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ');
}

// El texto sale del API, no de una cadena inventada aqui. Ver 02-reservas-concurrencia.md y 04-contrato-api.md.
function mensajeDe(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'No se pudo completar la operacion.';
}

type DatosContacto = { telefono: string; nombre: string; apellido: string; email: string };

const CONTACTO_VACIO: DatosContacto = { telefono: '', nombre: '', apellido: '', email: '' };

/** Horarios devueltos por el API, con la consulta a la que corresponden. */
type ResultadoHorarios = { clave: string; datos?: Disponibilidad; error?: string };

export function ReservarPage() {
  const { isAuthenticated } = useAuth();

  /**
   * Se elige primero a la persona y despues lo que hace: es la pregunta que el cliente
   * trae ya contestada ("quiero con Ana"), y ademas evita ofrecer un servicio para
   * luego decir que ese profesional no lo realiza. El catalogo entra por
   * `/empleados`, que ya trae los servicios de cada uno.
   */
  const [empleados, setEmpleados] = useState<EmpleadoPublico[] | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);

  const [empleadoId, setEmpleadoId] = useState('');
  const [servicioId, setServicioId] = useState('');
  const [fecha, setFecha] = useState(hoyEnISO);
  const [inicio, setInicio] = useState('');

  const [horarios, setHorarios] = useState<ResultadoHorarios | null>(null);

  const [contacto, setContacto] = useState<DatosContacto>(CONTACTO_VACIO);
  const [guardados, setGuardados] = useState<UsuarioActual | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [errorReserva, setErrorReserva] = useState<string | null>(null);
  const [reserva, setReserva] = useState<CitaReservada | null>(null);

  const empleado = useMemo(
    () => empleados?.find((opcion) => opcion.id === empleadoId) ?? null,
    [empleados, empleadoId],
  );
  const servicio = useMemo(
    () => empleado?.servicios.find((opcion) => opcion.id === servicioId) ?? null,
    [empleado, servicioId],
  );

  useEffect(() => {
    let vigente = true;
    empleadosService
      .list()
      .then((lista) => vigente && setEmpleados(lista))
      .catch((error) => vigente && setErrorCatalogo(mensajeDe(error)));
    return () => {
      vigente = false;
    };
  }, []);

  // Los datos guardados solo existen con sesion; sin ella el formulario es la unica
  // fuente y el telefono es lo que identifica a quien reserva.
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let vigente = true;
    authService
      .me()
      .then((usuario) => {
        if (!vigente) return;
        setGuardados(usuario);
        setContacto({
          telefono: usuario.telefono,
          nombre: usuario.nombre,
          apellido: usuario.apellido ?? '',
          email: usuario.email ?? '',
        });
      })
      .catch(() => vigente && setGuardados(null));
    return () => {
      vigente = false;
    };
  }, [isAuthenticated]);

  const claveConsulta =
    empleadoId && servicioId && fecha ? `${empleadoId}|${servicioId}|${fecha}` : '';

  // Los horarios se le piden al API y no se simulan. Entre esta consulta y la
  // confirmacion alguien mas puede tomar el espacio; de eso avisa el 409.
  // Ver 02-reservas-concurrencia.md.
  useEffect(() => {
    if (!claveConsulta) {
      return;
    }

    let vigente = true;
    citasService
      .disponibilidad({ servicioId, empleadoId, fecha })
      .then((datos) => vigente && setHorarios({ clave: claveConsulta, datos }))
      .catch((error) => vigente && setHorarios({ clave: claveConsulta, error: mensajeDe(error) }));

    return () => {
      vigente = false;
    };
  }, [claveConsulta, servicioId, empleadoId, fecha]);

  // Todo lo de abajo se deriva en vez de fijarse desde efectos: al cambiar de
  // profesional, de servicio o de fecha, lo elegido antes deja de corresponder con lo
  // que el API devolvio y por lo tanto deja de contar.
  const respuestaVigente = horarios?.clave === claveConsulta ? horarios : null;
  const disponibilidad = respuestaVigente?.datos ?? null;
  const errorHorarios = respuestaVigente?.error ?? null;
  const cargandoHorarios = !!claveConsulta && !respuestaVigente;

  const datosGuardados = isAuthenticated ? guardados : null;
  const inicioElegido =
    disponibilidad?.slots.some((slot) => slot.inicio === inicio) === true ? inicio : '';

  const formatoHora = useMemo(
    () =>
      new Intl.DateTimeFormat('es', {
        hour: '2-digit',
        minute: '2-digit',
        // La hora se muestra en la zona del negocio, que es en la que se agenda.
        timeZone: disponibilidad?.zonaHoraria ?? 'UTC',
      }),
    [disponibilidad?.zonaHoraria],
  );

  const elegirEmpleado = (elegido: EmpleadoPublico) => {
    setEmpleadoId(elegido.id);
    // El servicio depende de quien lo hace: uno que este profesional no realiza no vale.
    setServicioId(elegido.servicios.length === 1 ? elegido.servicios[0].id : '');
    setErrorReserva(null);
  };

  const puedeConfirmar =
    !!empleadoId &&
    !!servicioId &&
    !!inicioElegido &&
    (isAuthenticated || (contacto.telefono.trim() !== '' && contacto.nombre.trim() !== ''));

  const confirmar = async () => {
    setEnviando(true);
    setErrorReserva(null);
    try {
      const creada = await citasService.reservar({
        servicioId,
        empleadoId,
        inicio: inicioElegido,
        // Con sesion el cliente sale del token y el servidor ignora esto.
        cliente: isAuthenticated
          ? undefined
          : {
              telefono: contacto.telefono.trim(),
              nombre: contacto.nombre.trim(),
              apellido: contacto.apellido.trim() || undefined,
              email: contacto.email.trim() || undefined,
            },
      });
      setReserva(creada);
    } catch (error) {
      setErrorReserva(mensajeDe(error));
    } finally {
      setEnviando(false);
    }
  };

  if (reserva) {
    return (
      <main>
        <PageHeader title="Cita reservada" />
        <Card className="flex flex-col gap-3">
          <p className="text-text-h">
            {reserva.servicio.nombre} con {nombreCompleto(reserva.empleado.usuario)}
          </p>
          <p className="text-sm text-text">
            {new Intl.DateTimeFormat('es', { dateStyle: 'full', timeStyle: 'short' }).format(
              new Date(reserva.inicio),
            )}
          </p>
          <p className="text-sm text-text">
            Estado: {reserva.estado.nombre} · Total:{' '}
            {formatoPrecio.format(Number(reserva.costoTotal))}
          </p>
          {!isAuthenticated && (
            <p className="text-sm text-text">
              Guardamos la cita con su telefono. Para verla y cancelarla desde aqui,{' '}
              <Link to="/auth/login">inicie sesion</Link>.
            </p>
          )}
          <div className="mt-2">
            <ButtonLink to="/">Volver al inicio</ButtonLink>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-10">
      <PageHeader title="Reservar cita" />

      {errorCatalogo && (
        <EmptyState title="No se pudo cargar el catalogo" description={errorCatalogo} />
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-h">1 · Elija al profesional</h2>
        {!empleados && !errorCatalogo && <Spinner />}
        {empleados?.length === 0 && <EmptyState title="Todavia no hay profesionales publicados" />}
        <div className="grid gap-3 sm:grid-cols-2">
          {empleados?.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              onClick={() => elegirEmpleado(opcion)}
              aria-pressed={opcion.id === empleadoId}
              className={`${OPCION_CLASSES} ${opcion.id === empleadoId ? OPCION_ELEGIDA_CLASSES : ''}`}
            >
              <span className="block font-medium text-text-h">
                {nombreCompleto(opcion.usuario)}
              </span>
              <span className="mt-1 block text-sm text-text">
                {opcion.especialidad?.nombre ?? `${opcion.servicios.length} servicios`}
              </span>
            </button>
          ))}
        </div>
      </section>

      {empleado && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text-h">2 · Elija el servicio</h2>
          {empleado.servicios.length === 0 ? (
            <EmptyState
              title="Este profesional no tiene servicios asignados"
              description="Elija a otra persona o comuniquese con el negocio."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {empleado.servicios.map((opcion: ServicioDeEmpleado) => (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => setServicioId(opcion.id)}
                  aria-pressed={opcion.id === servicioId}
                  className={`${OPCION_CLASSES} ${
                    opcion.id === servicioId ? OPCION_ELEGIDA_CLASSES : ''
                  }`}
                >
                  <span className="block font-medium text-text-h">{opcion.nombre}</span>
                  <span className="mt-1 block text-sm text-text">
                    {opcion.duracionMinutos} min · {formatoPrecio.format(Number(opcion.precio))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {empleado && servicio && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text-h">3 · Elija fecha y hora</h2>
          <label className="flex max-w-xs flex-col gap-1 text-sm text-text">
            Fecha
            <input
              type="date"
              value={fecha}
              min={hoyEnISO()}
              onChange={(evento) => setFecha(evento.target.value)}
              className={CAMPO_CLASSES}
            />
          </label>

          {cargandoHorarios && <Spinner label="Buscando horarios..." />}
          {errorHorarios && <EmptyState title="No hay horarios" description={errorHorarios} />}
          {disponibilidad && disponibilidad.slots.length === 0 && (
            <EmptyState
              title="Sin horarios libres ese dia"
              description="Pruebe con otra fecha o con otro profesional."
            />
          )}
          {disponibilidad && disponibilidad.slots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {disponibilidad.slots.map((slot) => (
                <button
                  key={slot.inicio}
                  type="button"
                  onClick={() => setInicio(slot.inicio)}
                  aria-pressed={slot.inicio === inicioElegido}
                  className={`min-h-11 rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border ${
                    slot.inicio === inicioElegido
                      ? 'border-accent-border bg-accent-bg text-text-h'
                      : 'border-border text-text hover:border-accent-border'
                  }`}
                >
                  {formatoHora.format(new Date(slot.inicio))}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {empleado && servicio && inicioElegido && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text-h">4 · Sus datos</h2>
          <p className="text-sm text-text">
            No hace falta tener cuenta. Con el telefono basta para agendar y para que el
            negocio le encuentre.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-text sm:col-span-2">
              Telefono *
              <input
                type="tel"
                required
                autoComplete="tel"
                value={contacto.telefono}
                onChange={(evento) =>
                  setContacto((datos) => ({ ...datos, telefono: evento.target.value }))
                }
                placeholder="8888 8888"
                className={CAMPO_CLASSES}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-text">
              Nombre *
              <input
                type="text"
                required
                autoComplete="given-name"
                value={contacto.nombre}
                onChange={(evento) =>
                  setContacto((datos) => ({ ...datos, nombre: evento.target.value }))
                }
                className={CAMPO_CLASSES}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-text">
              Apellido
              <input
                type="text"
                autoComplete="family-name"
                value={contacto.apellido}
                onChange={(evento) =>
                  setContacto((datos) => ({ ...datos, apellido: evento.target.value }))
                }
                className={CAMPO_CLASSES}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-text sm:col-span-2">
              Correo (opcional)
              <input
                type="email"
                autoComplete="email"
                value={contacto.email}
                onChange={(evento) =>
                  setContacto((datos) => ({ ...datos, email: evento.target.value }))
                }
                className={CAMPO_CLASSES}
              />
            </label>
          </div>

          {datosGuardados && (
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-text-h">Sus datos guardados</p>
                <p className="text-sm text-text">
                  {nombreCompleto(datosGuardados)} · {datosGuardados.telefono}
                </p>
                <p className="mt-1 text-xs text-text">
                  Con la sesion abierta, la cita se registra en su cuenta.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setContacto({
                    telefono: datosGuardados.telefono,
                    nombre: datosGuardados.nombre,
                    apellido: datosGuardados.apellido ?? '',
                    email: datosGuardados.email ?? '',
                  })
                }
              >
                Usar estos datos
              </Button>
            </Card>
          )}

          {/* El texto sale del API. Se enmarca para que no se lea como una linea mas
              del formulario, pero con los tokens que ya existen: la paleta no tiene
              color de error, e inventarlo aqui seria decidir marca de paso. */}
          {errorReserva && (
            <p
              role="alert"
              className="rounded-lg border border-accent-border bg-accent-bg px-4 py-3 text-sm font-medium text-text-h"
            >
              {errorReserva}
            </p>
          )}

          <div>
            <Button onClick={confirmar} disabled={!puedeConfirmar || enviando}>
              {enviando ? 'Reservando...' : 'Confirmar reserva'}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}

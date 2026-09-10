import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { Card, CARD_SHELL_CLASSES } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { DateTimePicker, type OpcionHora } from '../../components/ui/DateTimePicker';
import { CAMPO_CLASSES } from '../../components/ui/Field';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Spinner } from '../../components/ui/Spinner';
import { Thumbnail } from '../../components/ui/Thumbnail';
import { useAuth } from '../../context/AuthContext';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { iniciales } from '../../lib/especialista';
import { hoyEnISO } from '../../lib/fechaISO';
import { citasService, type CitaReservada, type Disponibilidad } from '../../services/citasService';
import {
  empleadosService,
  type EmpleadoPublico,
  type ServicioDeEmpleado,
} from '../../services/empleadosService';

// TODO: moneda y locale salen de ConfiguracionNegocio; falta el endpoint publico
// /configuracion. Hasta entonces se formatea el numero sin simbolo. Ver 05-marca-y-responsive.md.
const { locale } = configuracionPlaceholder;
const formatoPrecio = new Intl.NumberFormat(locale, { minimumFractionDigits: 2 });

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

// La opcion elegida no se marca solo con color: lleva el disco con el check, que es la
// senal que sobrevive a un daltonismo y a una pantalla mal calibrada.
const OPCION_CLASSES = `${CARD_SHELL_CLASSES} group relative w-full p-4 text-left transition-[border-color,box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-lg hover:shadow-black/5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border`;
const OPCION_ELEGIDA_CLASSES = 'border-accent-border bg-accent-bg shadow-xs';

function IconoCheck({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

/** Disco de seleccion de una opcion. Vacio en reposo, con el check cuando esta elegida. */
function Marca({ elegida }: { elegida: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
        elegida
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-border text-transparent group-hover:border-accent-border'
      }`}
    >
      <IconoCheck className="size-3" />
    </span>
  );
}

/**
 * Un paso del flujo. El numero y el resumen a la derecha son lo que permite volver a un
 * paso ya resuelto sin releerlo entero: el titulo dice que se pide y el resumen, que se
 * eligio.
 */
function Paso({
  numero,
  titulo,
  resumen,
  children,
}: {
  numero: number;
  titulo: string;
  resumen?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="flex animate-fade-up flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <span
          aria-hidden="true"
          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors ${
            resumen ? 'bg-accent text-accent-fg' : 'border border-border bg-surface text-text'
          }`}
        >
          {resumen ? <IconoCheck className="size-4" /> : numero}
        </span>
        <h2 className="flex-1 text-xl">{titulo}</h2>
        {resumen && (
          <span className="rounded-full border border-accent-border bg-accent-bg px-3 py-1 text-xs font-medium text-text-h">
            {resumen}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function ReservarPage() {
  // `usuario` sale del contexto y no de un `GET /auth/me` propio: `AuthProvider` ya lo
  // pidio al arrancar, y una segunda copia aqui se desincroniza en cuanto alguien edita
  // su perfil en otra pestana.
  const { isAuthenticated, usuario } = useAuth();

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

  /**
   * Lo que el usuario **escribio**. `null` mientras no toque nada, y entonces el
   * formulario se deriva de su ficha.
   *
   * Antes esto se sembraba desde un efecto al llegar la respuesta de `/auth/me`, y eso
   * tenia dos fallas: los campos aparecian vacios y se llenaban solos un instante despues,
   * y si el cliente empezaba a escribir antes de que llegara, la respuesta le pisaba lo
   * escrito. Derivado no hay ningun instante en que el formulario este vacio teniendo
   * ficha, ni forma de que algo borre lo que el cliente puso.
   */
  const [contactoEditado, setContactoEditado] = useState<DatosContacto | null>(null);

  // Desmarcada por defecto: una casilla marcada de antemano no es consentimiento.

  const [aceptaWhatsapp, setAceptaWhatsapp] = useState(false);

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

  // Los datos guardados solo existen con sesion; sin ella el formulario es la unica
  // fuente y el telefono es lo que identifica a quien reserva.
  const datosGuardados = isAuthenticated ? usuario : null;
  const contactoDelPerfil: DatosContacto | null = datosGuardados
    ? {
        telefono: datosGuardados.telefono,
        nombre: datosGuardados.nombre,
        apellido: datosGuardados.apellido ?? '',
        email: datosGuardados.email ?? '',
      }
    : null;
  const contacto = contactoEditado ?? contactoDelPerfil ?? CONTACTO_VACIO;
  /** Si lo escrito ya no es lo de la ficha: es lo unico que hace util "Usar estos datos". */
  const contactoTocado =
    contactoEditado !== null &&
    contactoDelPerfil !== null &&
    (Object.keys(contactoEditado) as (keyof DatosContacto)[]).some(
      (campo) => contactoEditado[campo] !== contactoDelPerfil[campo],
    );
  const inicioElegido =
    disponibilidad?.slots.some((slot) => slot.inicio === inicio) === true ? inicio : '';

  const formatoHora = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        // La hora se muestra en la zona del negocio, que es en la que se agenda.
        timeZone: disponibilidad?.zonaHoraria ?? 'UTC',
      }),
    [disponibilidad?.zonaHoraria],
  );

  // El picker no sabe de slots del API: recibe pares valor/etiqueta ya formateados en la
  // zona del negocio.
  const opcionesHora: OpcionHora[] | null = useMemo(
    () =>
      disponibilidad?.slots.map((slot) => ({
        valor: slot.inicio,
        etiqueta: formatoHora.format(new Date(slot.inicio)),
      })) ?? null,
    [disponibilidad, formatoHora],
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
        // Opt-in explicito: sin el, el servidor no encola un solo mensaje.
        aceptaWhatsapp: isAuthenticated ? undefined : aceptaWhatsapp,
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
        <Card className="flex animate-fade-up flex-col gap-4">
          <span
            aria-hidden="true"
            className="inline-flex size-12 items-center justify-center rounded-full bg-success-bg text-success"
          >
            <IconoCheck className="size-6" />
          </span>

          <div>
            <p className="text-xl text-text-h">{reserva.servicio.nombre}</p>
            <p className="text-sm text-text">
              con {nombreCompleto(reserva.empleado.usuario)}
            </p>
          </div>

          <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium tracking-wide text-text-muted uppercase">
                Cuando
              </dt>
              <dd className="mt-0.5 text-sm text-text-h">
                {new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(
                  new Date(reserva.inicio),
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-text-muted uppercase">
                Estado
              </dt>
              <dd className="mt-0.5 text-sm text-text-h">{reserva.estado.nombre}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-text-muted uppercase">Total</dt>
              <dd className="mt-0.5 text-sm font-semibold text-price tabular-nums">
                {formatoPrecio.format(Number(reserva.costoTotal))}
              </dd>
            </div>
          </dl>

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

      <Paso
        numero={1}
        titulo="Elija al profesional"
        resumen={empleado ? nombreCompleto(empleado.usuario) : null}
      >
        {!empleados && !errorCatalogo && <Spinner />}
        {empleados?.length === 0 && <EmptyState title="Todavia no hay profesionales publicados" />}
        <div className="grid gap-3 stagger-in sm:grid-cols-2 lg:grid-cols-3">
          {empleados?.map((opcion) => {
            const elegido = opcion.id === empleadoId;
            return (
              <button
                key={opcion.id}
                type="button"
                onClick={() => elegirEmpleado(opcion)}
                aria-pressed={elegido}
                className={`${OPCION_CLASSES} ${elegido ? OPCION_ELEGIDA_CLASSES : ''}`}
              >
                <span className="flex items-start gap-3">
                  <Thumbnail
                    src={opcion.fotoUrl}
                    fallback={iniciales(opcion.usuario.nombre, opcion.usuario.apellido)}
                    className="size-12 rounded-full text-sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-text-h">
                      {nombreCompleto(opcion.usuario)}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-text-muted">
                      {opcion.especialidad?.nombre ?? `${opcion.servicios.length} servicios`}
                    </span>
                  </span>
                  <Marca elegida={elegido} />
                </span>
              </button>
            );
          })}
        </div>
      </Paso>

      {empleado && (
        <Paso numero={2} titulo="Elija el servicio" resumen={servicio?.nombre ?? null}>
          {empleado.servicios.length === 0 ? (
            <EmptyState
              title="Este profesional no tiene servicios asignados"
              description="Elija a otra persona o comuniquese con el negocio."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {empleado.servicios.map((opcion: ServicioDeEmpleado) => {
                const elegido = opcion.id === servicioId;
                return (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setServicioId(opcion.id)}
                    aria-pressed={elegido}
                    className={`${OPCION_CLASSES} ${elegido ? OPCION_ELEGIDA_CLASSES : ''}`}
                  >
                    <span className="flex items-start gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-text-h">{opcion.nombre}</span>
                        <span className="mt-1 flex items-baseline gap-2 text-sm">
                          <span className="text-text-muted tabular-nums">
                            {opcion.duracionMinutos} min
                          </span>
                          <span aria-hidden="true" className="text-border">
                            ·
                          </span>
                          <span className="font-semibold text-price tabular-nums">
                            {formatoPrecio.format(Number(opcion.precio))}
                          </span>
                        </span>
                      </span>
                      <Marca elegida={elegido} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Paso>
      )}

      {empleado && servicio && (
        <Paso
          numero={3}
          titulo="Elija fecha y hora"
          resumen={
            inicioElegido
              ? new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: disponibilidad?.zonaHoraria ?? 'UTC',
                }).format(new Date(inicioElegido))
              : null
          }
        >
          <DateTimePicker
            fecha={fecha}
            onFechaChange={setFecha}
            minFecha={hoyEnISO()}
            locale={locale}
            hora={inicioElegido}
            onHoraChange={setInicio}
            opciones={opcionesHora}
            cargando={cargandoHorarios}
            zonaHoraria={disponibilidad?.zonaHoraria ?? null}
          />

          {errorHorarios && <Alert>{errorHorarios}</Alert>}
          {disponibilidad && disponibilidad.slots.length === 0 && (
            <EmptyState
              title="Sin horarios libres ese dia"
              description="Pruebe con otra fecha o con otro profesional."
            />
          )}
        </Paso>
      )}

      {empleado && servicio && inicioElegido && (
        <Paso numero={4} titulo="Sus datos">
          <p className="text-sm text-text">
            No hace falta tener cuenta. Con el telefono basta para agendar y para que el
            negocio le encuentre.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-text sm:col-span-2">
              Telefono *
              <input
                type="tel"
                required
                autoComplete="tel"
                value={contacto.telefono}
                onChange={(evento) =>
                  setContactoEditado({ ...contacto, telefono: evento.target.value })
                }
                placeholder="8888 8888"
                className={CAMPO_CLASSES}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text">
              Nombre *
              <input
                type="text"
                required
                autoComplete="given-name"
                value={contacto.nombre}
                onChange={(evento) =>
                  setContactoEditado({ ...contacto, nombre: evento.target.value })
                }
                className={CAMPO_CLASSES}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text">
              Apellido
              <input
                type="text"
                autoComplete="family-name"
                value={contacto.apellido}
                onChange={(evento) =>
                  setContactoEditado({ ...contacto, apellido: evento.target.value })
                }
                className={CAMPO_CLASSES}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text sm:col-span-2">
              Correo (opcional)
              <input
                type="email"
                autoComplete="email"
                value={contacto.email}
                onChange={(evento) =>
                  setContactoEditado({ ...contacto, email: evento.target.value })
                }
                className={CAMPO_CLASSES}
              />
            </label>
            {/* La casilla es toda el area de la fila: en un telefono, apuntarle a un cuadro
                de 16px es lo que hace que el opt-in se marque sin querer o no se marque. */}
            <label
              className={`${CARD_SHELL_CLASSES} flex cursor-pointer items-start gap-3 p-4 text-sm text-text transition-colors hover:border-accent-border has-checked:border-accent-border has-checked:bg-accent-bg sm:col-span-2`}
            >
              <input
                type="checkbox"
                checked={aceptaWhatsapp}
                onChange={(evento) => setAceptaWhatsapp(evento.target.checked)}
                className="mt-0.5 size-4.5 shrink-0 accent-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border"
              />
              <span>
                Quiero recibir por WhatsApp el aviso de esta cita y el enlace para
                confirmarla.
              </span>
            </label>
          </div>

          {/* Con sesion, los campos de arriba ya vienen con la ficha puesta. Esta tarjeta
              confirma **con que cuenta** se esta agendando —quien tiene dos numeros lo
              necesita— y ofrece deshacer solo cuando hay algo que deshacer: un boton
              "Usar estos datos" junto a unos campos que ya los tienen no hace nada. */}
          {datosGuardados && (
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-text-h">Sus datos guardados</p>
                <p className="text-sm text-text">
                  {nombreCompleto(datosGuardados)} · {datosGuardados.telefono}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {contactoTocado
                    ? 'Cambio los datos de contacto de esta cita. Su perfil no se modifica.'
                    : 'Con la sesion abierta, la cita se registra en su cuenta.'}
                </p>
              </div>
              {contactoTocado && (
                <Button variant="secondary" onClick={() => setContactoEditado(null)}>
                  Usar estos datos
                </Button>
              )}
            </Card>
          )}

          {/* Lo elegido, junto, antes de confirmar: es la ultima oportunidad de ver un
              error propio sin tener que volver a subir por los pasos. */}
          <Card className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Resumen</p>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-text">Profesional</dt>
                <dd className="text-right text-text-h">{nombreCompleto(empleado.usuario)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text">Servicio</dt>
                <dd className="text-right text-text-h">
                  {servicio.nombre}
                  <span className="text-text-muted tabular-nums">
                    {' '}
                    · {servicio.duracionMinutos} min
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text">Cuando</dt>
                <dd className="text-right text-text-h">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'full',
                    timeStyle: 'short',
                    timeZone: disponibilidad?.zonaHoraria ?? 'UTC',
                  }).format(new Date(inicioElegido))}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="font-medium text-text-h">Total</dt>
                <dd className="text-right font-semibold text-price tabular-nums">
                  {formatoPrecio.format(Number(servicio.precio))}
                </dd>
              </div>
            </dl>
          </Card>

          {/* El texto sale del API, no de una cadena inventada aqui. */}
          {errorReserva && <Alert>{errorReserva}</Alert>}

          <div>
            <Button onClick={confirmar} disabled={!puedeConfirmar || enviando}>
              {enviando ? 'Reservando...' : 'Confirmar reserva'}
            </Button>
          </div>
        </Paso>
      )}
    </main>
  );
}

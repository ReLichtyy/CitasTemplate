import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { Card } from '../../components/ui/Card';
import { DateTimePicker, type OpcionHora } from '../../components/ui/DateTimePicker';
import { EstadoBadge } from '../../components/ui/EstadoBadge';
import { CAMPO_CLASSES } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { useAccionApi } from '../../hooks/useAccionApi';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { hoyEnISO } from '../../lib/fechaISO';
import { diaLocalDeISO, formatFechaLarga, formatRangoHoras } from '../../lib/formatFechaHora';
import { puedeEditar } from '../../lib/permisosCita';
import { citasService, type Disponibilidad } from '../../services/citasService';

/** Lo mismo que topa `ActualizarCitaDto.notas` en el API. */
const MAX_NOTAS = 2000;

type ConsultaHorarios = { clave: string; datos?: Disponibilidad; error?: string };

/**
 * Reprogramar una cita y editar sus notas.
 *
 * `PATCH /citas/:id` es `@Roles(ADMIN, EMPLEADO)`: un cliente que llegue aqui por la URL
 * ve el aviso y no el formulario. Igual lo volveria a rechazar el servidor — esta
 * comprobacion solo evita ofrecer un 403.
 *
 * **Que no hace y por que:** cambiar el estado (marcar atendida, no asistio). El cuerpo
 * del PATCH lo admite (`estadoCodigo`), pero ninguna ruta expone el catalogo de
 * `EstadoCita`, y escribir los codigos aqui convertiria una tabla de configuracion en una
 * constante del frontend — que es justo lo que `01-modelo-datos.md` no quiere. Falta un
 * `GET /citas/estados`; con el, el selector son diez lineas.
 *
 * **Lo que el API todavia no da:** `GET /citas/disponibilidad` no excluye la cita que se
 * esta reprogramando, asi que su hora actual sale de la lista como ocupada — se ocupa a si
 * misma. No estorba (nadie reprograma a la misma hora) pero explica el hueco, y por eso la
 * hora actual se muestra aparte en vez de aparecer preseleccionada.
 */
export function EditarCitaPage() {
  const { id } = useParams<{ id: string }>();
  const { rol } = useAuth();
  const navigate = useNavigate();
  const { locale } = configuracionPlaceholder;

  const cargar = useCallback(() => citasService.get(id ?? ''), [id]);
  const { datos: cita, cargando, error } = useRecursoApi(cargar, [id]);

  const [inicio, setInicio] = useState('');
  const [horarios, setHorarios] = useState<ConsultaHorarios | null>(null);

  /**
   * Los dos campos editables arrancan en `null`, que significa "no lo ha tocado nadie", y
   * el valor que se pinta se **deriva** de la cita mientras siga asi.
   *
   * La alternativa —sembrarlos desde un efecto cuando llega la cita— encadena un render de
   * mas y, peor, vuelve a pisar lo que el usuario escribio cada vez que la cita se recarga.
   * Aqui no hay ningun momento en que el formulario este vacio ni en que se borre solo.
   */
  const [fechaElegida, setFechaElegida] = useState<string | null>(null);
  const [notasEditadas, setNotasEditadas] = useState<string | null>(null);

  const fecha = fechaElegida ?? (cita ? diaLocalDeISO(cita.inicio) : '');
  const notas = notasEditadas ?? cita?.notas ?? '';

  const clave = cita && fecha ? `${cita.empleadoId}|${cita.servicioId}|${fecha}` : '';

  // Los horarios los da el API; aqui no se simula ninguna disponibilidad. Entre esta
  // consulta y el PATCH alguien mas puede tomar el espacio: de eso avisa el 409.
  useEffect(() => {
    if (!clave || !cita) {
      return;
    }
    let vigente = true;
    citasService
      .disponibilidad({ empleadoId: cita.empleadoId, servicioId: cita.servicioId, fecha })
      .then((datos) => vigente && setHorarios({ clave, datos }))
      .catch((fallo: unknown) => {
        if (vigente) {
          setHorarios({
            clave,
            error: fallo instanceof Error ? fallo.message : 'No se pudieron cargar los horarios.',
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, [clave, cita, fecha]);

  // Derivado y no guardado en un efecto: al cambiar de dia, la hora elegida antes deja de
  // corresponder con lo que el API devolvio y por lo tanto deja de contar.
  const vigente = horarios?.clave === clave ? horarios : null;
  const disponibilidad = vigente?.datos ?? null;
  const errorHorarios = vigente?.error ?? null;
  const cargandoHorarios = !!clave && !vigente;
  const inicioElegido = disponibilidad?.slots.some((s) => s.inicio === inicio) ? inicio : '';

  const formatoHora = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        // La hora se muestra en la zona del negocio, que es en la que se agenda.
        timeZone: disponibilidad?.zonaHoraria ?? 'UTC',
      }),
    [locale, disponibilidad?.zonaHoraria],
  );

  const opcionesHora: OpcionHora[] | null = useMemo(
    () =>
      disponibilidad?.slots.map((slot) => ({
        valor: slot.inicio,
        etiqueta: formatoHora.format(new Date(slot.inicio)),
      })) ?? null,
    [disponibilidad, formatoHora],
  );

  const guardar = useAccionApi(citasService.update);

  if (cargando) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <Skeleton className="h-9 w-64" />
        <Card className="flex flex-col gap-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </Card>
      </div>
    );
  }

  if (error || !cita) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <PageHeader title="Reprogramar" />
        <Alert>{error ?? 'Recurso no encontrado.'}</Alert>
        <ButtonLink to="/citas" variant="secondary" className="self-start">
          Volver a las citas
        </ButtonLink>
      </div>
    );
  }

  if (!puedeEditar(cita, rol)) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <PageHeader title="Reprogramar" />
        <Alert>
          {cita.estado.permiteEdicion
            ? 'Solo el negocio puede reprogramar una cita. Para cambiarla, comuniquese con el.'
            : `Una cita ${cita.estado.nombre.toLowerCase()} ya no se puede reprogramar.`}
        </Alert>
        <ButtonLink to={`/citas/${cita.id}`} variant="secondary" className="self-start">
          Volver a la cita
        </ButtonLink>
      </div>
    );
  }

  const notasCambiaron = notas.trim() !== (cita.notas ?? '').trim();
  const hayCambios = inicioElegido !== '' || notasCambiaron;

  async function enviar() {
    if (!cita || !hayCambios) {
      return;
    }
    // Solo lo que cambio: mandar `inicio` sin cambio obligaria al servidor a rehacer la
    // verificacion de traslape contra el espacio que la cita ya ocupa.
    const resultado = await guardar.ejecutar(cita.id, {
      ...(inicioElegido ? { inicio: inicioElegido } : {}),
      ...(notasCambiaron ? { notas: notas.trim() } : {}),
    });
    if (resultado) {
      navigate(`/citas/${resultado.id}`, { replace: true });
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title="Reprogramar"
        actions={
          <Link to={`/citas/${cita.id}`} className="shrink-0 text-sm text-text hover:text-text-h">
            Volver
          </Link>
        }
      />

      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-base">{cita.servicio.nombre}</h2>
          <EstadoBadge estado={cita.estado} />
        </div>
        <p className="m-0 text-sm text-text">
          Ahora: {formatFechaLarga(cita.inicio, locale)},{' '}
          {formatRangoHoras(cita.inicio, cita.fin, locale)} con {cita.empleado.usuario.nombre}{' '}
          {cita.empleado.usuario.apellido ?? ''}
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="m-0 text-base">Nueva fecha y hora</h2>

        <DateTimePicker
          fecha={fecha}
          onFechaChange={(dia) => {
            setFechaElegida(dia);
            // El instante elegido pertenecia al dia anterior: dejarlo puesto mandaria al
            // API una hora que ya no corresponde con lo que se esta viendo.
            setInicio('');
          }}
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
          <p className="m-0 text-sm text-text-muted">
            No queda ningun espacio libre ese dia con {cita.empleado.usuario.nombre}. Pruebe con
            otra fecha.
          </p>
        )}

        <p className="m-0 text-xs text-text-muted">
          La hora que la cita ocupa hoy no aparece en la lista: la tiene tomada ella misma.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm text-text">
          <span className="text-base text-text-h">Notas</span>
          <textarea
            rows={4}
            maxLength={MAX_NOTAS}
            value={notas}
            disabled={guardar.enviando}
            placeholder="Lo que convenga recordar de esta cita."
            onChange={(evento) => setNotasEditadas(evento.target.value)}
            className={`${CAMPO_CLASSES} min-h-24 resize-y py-2`}
          />
        </label>
      </Card>

      {/* El texto sale del API. El caso que importa es el 409: entre que se pidieron los
          horarios y se pulso Guardar, alguien tomo el espacio. Ver 02-reservas-concurrencia.md. */}
      {guardar.error && <Alert>{guardar.error}</Alert>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={enviar} disabled={!hayCambios || guardar.enviando}>
          {guardar.enviando ? 'Guardando...' : 'Guardar cambios'}
        </Button>
        <ButtonLink to={`/citas/${cita.id}`} variant="secondary">
          Descartar
        </ButtonLink>
      </div>
    </div>
  );
}

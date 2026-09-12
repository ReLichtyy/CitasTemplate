import { ButtonLink } from '../../components/ui/ButtonLink';
import { CARD_SHELL_CLASSES } from '../../components/ui/Card';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { SeccionHeader } from '../../components/ui/SeccionHeader';
import { MarcaNegocio } from '../../components/ui/MarcaNegocio';
import { Thumbnail } from '../../components/ui/Thumbnail';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { formatPrice } from '../../lib/formatPrice';
import { serviciosService } from '../../services/serviciosService';

// Copy de la pagina, no configuracion del negocio: no existe como campo en
// ConfiguracionNegocio y no tiene por que ser configurable.
const BAJADA = 'Elegi un horario y confirma al instante.';

// 06-hero-landing.md: si el negocio no cargo eslogan, el h1 cae a un titular neutro de rubro.
const TITULAR_NEUTRO = 'Reserva tu cita en minutos';

// Generica a proposito, como pide 05-marca-y-responsive.md: una promesa de marca, no una
// resena inventada (no hay autor ni foto porque no es una cita real).
const FRASE_CONFIANZA = 'Sabemos lo que hace bueno un servicio.';
const FRASE_CONFIANZA_BAJADA = 'Por eso cada detalle de tu cita esta pensado para que vuelvas.';

// Datos rapidos bajo el hero: copy de la pagina, no configuracion del negocio (mismo
// criterio que BAJADA/FRASE_CONFIANZA) — ninguna fila afirma un horario ni un numero de
// personal que no salga de una fuente real, asi que quedan como promesas de flujo, no
// como datos.
const DATOS_RAPIDOS = (terminoEmpleadoPlural: string) =>
  [
    { etiqueta: 'Confirmacion', valor: 'Al instante, sin esperar respuesta' },
    { etiqueta: 'Sin cuenta', valor: 'Reservas con tu telefono' },
    { etiqueta: terminoEmpleadoPlural, valor: 'Elegis con quien atenderte' },
  ] as const;

// Describe el flujo real (03-autorizacion.md: se reserva sin sesion, con telefono y
// nombre), no un generico "es facil" — cada paso es algo que la app efectivamente hace.
const PASOS_RESERVA = [
  { numero: '1', titulo: 'Elegi tu servicio', descripcion: 'Mira el catalogo y elegi lo que necesitas.' },
  { numero: '2', titulo: 'Elegi fecha y hora', descripcion: 'Disponibilidad real, al instante.' },
  { numero: '3', titulo: 'Confirma', descripcion: 'Dejas tu telefono y listo, sin crear cuenta.' },
] as const;

const MASCARA_MARQUEE =
  'linear-gradient(to right, transparent, black 10%, black 90%, transparent)';

function ServiciosMarquee() {
  const { moneda, locale } = configuracionPlaceholder;
  const { datos, cargando, error } = useRecursoApi(() => serviciosService.list());
  const servicios = datos ?? [];

  // Decorativo, no la fuente de verdad: el catalogo real y navegable vive en /servicios y
  // /equipo. Si todavia no hay nada que mostrar, la seccion no aparece a medias.
  if (cargando || error || servicios.length === 0) {
    return null;
  }

  // Duplicado para el loop continuo (misma pista dos veces): son los mismos datos reales,
  // no un catalogo inventado. La copia repetida se oculta al lector de pantalla.
  const pista = [...servicios, ...servicios];

  return (
    <section className="overflow-hidden border-y border-border bg-surface py-10 sm:py-14">
      {/* Visible, sin aria-hidden: solo la pista que sigue (la repeticion decorativa del
          catalogo) se le oculta al lector de pantalla, no la seccion entera. */}
      <Eyebrow className="mb-6 text-center">Nuestro catalogo</Eyebrow>
      <div
        aria-hidden="true"
        className="marquee-track flex w-max gap-5"
        style={{ maskImage: MASCARA_MARQUEE, WebkitMaskImage: MASCARA_MARQUEE }}
      >
        {pista.map((servicio, i) => {
          const tieneImagen = Boolean(servicio.imagenUrl);
          return (
            <div
              key={`${servicio.id}-${i}`}
              className="relative h-44 w-64 shrink-0 overflow-hidden rounded-2xl border border-border shadow-xs shadow-black/5 sm:h-52 sm:w-72"
            >
              <Thumbnail
                src={servicio.imagenUrl}
                fallback={servicio.nombre.charAt(0).toUpperCase()}
                className="h-full w-full text-5xl"
              />
              {/* Mismo foco que las cards del catalogo (`foco-imagen` en index.css), y solo
                  con foto real: sobre el fallback —monograma claro— el oscurecido se lee
                  como error de carga, no como foco. */}
              {tieneImagen && <div className="foco-imagen absolute inset-0" />}
              {/* Dato real de la ficha, no adorno: la duracion es lo segundo que se
                  pregunta despues del precio, y la card ya la tenia a mano. */}
              <span
                className={`font-mono absolute top-3 left-3 rounded-full px-2 py-1 text-eyebrow tracking-eyebrow uppercase ${
                  tieneImagen ? 'bg-black/45 text-white' : 'border border-border bg-bg/85 text-text-muted'
                }`}
              >
                {servicio.duracionMinutos} min
              </span>
              <div
                className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 ${tieneImagen ? '' : 'bg-bg/85'}`}
              >
                <span
                  className={`text-base font-semibold ${tieneImagen ? 'text-white' : 'text-text-h'}`}
                >
                  {servicio.nombre}
                </span>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${tieneImagen ? 'text-white/90' : 'text-price'}`}
                >
                  {formatPrice(servicio.precio, moneda, locale)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FraseConfianza() {
  return (
    <section className="relative overflow-hidden px-4 py-14 text-center sm:py-18">
      {/* Misma mancha radial que --color-glow del fondo (index.css), aqui quieta y mas
          concentrada: una sola fuente de luz detras de la frase, no una imagen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(45% 60% at 50% 45%, var(--color-glow), transparent 70%)',
        }}
      />
      <p
        aria-hidden="true"
        className="font-heading pointer-events-none mb-2 text-6xl leading-none text-accent/25 select-none sm:text-7xl"
      >
        &ldquo;
      </p>
      <p className="font-heading mx-auto -mt-8 max-w-2xl text-2xl leading-snug font-normal text-balance text-text-h italic sm:text-3xl md:text-4xl">
        {FRASE_CONFIANZA}
      </p>
      <p className="mt-4 text-sm text-pretty text-text-muted">{FRASE_CONFIANZA_BAJADA}</p>
    </section>
  );
}

function ComoReservar() {
  return (
    <section className="border-t border-border px-4 py-14 sm:py-18">
      <SeccionHeader
        eyebrow="Como funciona"
        titulo="Reservar toma un minuto"
        descripcion="Tres pasos, sin llamadas y sin formularios largos."
      />

      {/* Cards y no columnas sueltas: el paso pasa a ser una cosa con bordes, y la linea
          punteada entre una y otra es la que dice que van en ese orden. Sin hover: nada de
          esto se toca, y levantar una card que no navega promete algo que no pasa. */}
      <ol className="mx-auto mt-10 grid max-w-3xl gap-4 stagger-in sm:grid-cols-3 sm:gap-6">
        {PASOS_RESERVA.map((paso, indice) => (
          <li
            key={paso.numero}
            className={`${CARD_SHELL_CLASSES} relative flex h-full flex-col items-center gap-2 px-5 pt-9 pb-7 text-center shadow-xs shadow-black/5`}
          >
            {/* El numero monta el borde superior: es lo que hace que la card se lea como
                un paso numerado y no como una card mas del catalogo. */}
            <span
              className="font-mono absolute -top-5 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-accent-border bg-accent-bg text-base font-medium text-accent-ink shadow-xs shadow-black/5"
              aria-hidden="true"
            >
              {paso.numero}
            </span>
            {indice < PASOS_RESERVA.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-0 -right-6 hidden w-6 border-t border-dashed border-border sm:block"
              />
            )}
            <p className="text-base font-semibold text-text-h">{paso.titulo}</p>
            <p className="max-w-56 text-sm text-pretty text-text-muted">{paso.descripcion}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Cierre de la pagina: el ultimo bloque no puede ser un boton suelto colgando de la
 * seccion anterior. Es un panel propio —la misma superficie que las cards— para que la
 * landing termine en algo, y no se desvanezca contra el pie.
 */
function CierreCTA() {
  return (
    <section className="px-4 pb-14 sm:pb-18">
      <div
        className={`${CARD_SHELL_CLASSES} relative mx-auto flex max-w-3xl flex-col items-center gap-5 overflow-hidden px-6 py-10 text-center shadow-xs shadow-black/5 sm:px-12 sm:py-12`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(70% 90% at 50% 0%, var(--color-glow), transparent 70%)',
          }}
        />
        <h2 className="relative text-2xl text-balance sm:text-3xl">Tu horario te esta esperando</h2>
        <p className="relative max-w-md text-sm text-pretty text-text-muted">
          Mira la disponibilidad real de cada profesional y quedate con el espacio que te sirve.
        </p>
        <div className="relative flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <ButtonLink to="/citas/reservar" className="w-full sm:w-auto">
            Agendar Cita
          </ButtonLink>
          <ButtonLink to="/servicios" variant="secondary" className="w-full sm:w-auto">
            Ver servicios
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  const { terminoEmpleadoPlural } = configuracionPlaceholder;

  return (
    <>
      {/* El aire crece hacia abajo (4 → 5 → 10): es lo que hace que se lea como jerarquia
          y no como una lista centrada. Ver 06-hero-landing.md. */}
      <section className="relative flex animate-fade-up flex-col items-center px-4 pt-12 pb-14 text-center sm:pt-20 sm:pb-16">
        {/* Una sola fuente de luz detras del titular, la misma mancha de --color-glow que
            usa el resto de la pagina. No es una imagen decorativa —que el spec descarta—
            sino el fondo puesto a foco donde esta lo que hay que leer. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: 'radial-gradient(50% 55% at 50% 38%, var(--color-glow), transparent 70%)',
          }}
        />
        <MarcaNegocio
          imgClassName="mb-4 max-h-14 w-auto md:max-h-18"
          textClassName="mb-4 text-xl font-semibold tracking-tight text-text-h md:text-2xl"
        />
        <h1 className="mb-5 max-w-3xl text-3xl leading-tight text-balance md:text-4xl lg:text-5xl">
          {configuracionPlaceholder.eslogan ?? TITULAR_NEUTRO}
        </h1>
        <p className="mb-10 max-w-sm text-pretty text-text">{BAJADA}</p>
        <div className="flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <ButtonLink to="/citas/reservar" variant="primary" className="w-full sm:w-auto">
            Agendar Cita
          </ButtonLink>
          <ButtonLink to="/equipo" variant="secondary" className="w-full sm:w-auto">
            {terminoEmpleadoPlural}
          </ButtonLink>
        </div>

        {/* Tres promesas del flujo, no datos de negocio: por eso ninguna fila lleva un
            horario ni un numero de personal inventado. */}
        <dl className="relative mt-10 flex w-full max-w-sm flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface text-left shadow-xs shadow-black/5 sm:max-w-md">
          {DATOS_RAPIDOS(terminoEmpleadoPlural).map(({ etiqueta, valor }) => (
            <div key={etiqueta} className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="font-mono text-eyebrow font-medium tracking-eyebrow text-text-muted uppercase">
                {etiqueta}
              </dt>
              <dd className="text-right text-sm text-text-h">{valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ServiciosMarquee />
      <FraseConfianza />
      <ComoReservar />
      <CierreCTA />
    </>
  );
}

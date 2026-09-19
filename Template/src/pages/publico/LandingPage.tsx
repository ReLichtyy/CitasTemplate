import { Link } from 'react-router-dom';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { CARD_MEDIA_INTERACTIVE_CLASSES, CARD_SHELL_CLASSES } from '../../components/ui/Card';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { IconoVideo } from '../../components/ui/IconoVideo';
import { SeccionHeader } from '../../components/ui/SeccionHeader';
import { MarcaNegocio } from '../../components/ui/MarcaNegocio';
import { Thumbnail } from '../../components/ui/Thumbnail';
import { useRecursoApi } from '../../hooks/useRecursoApi';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { construirGaleria } from '../../lib/galeria';
import { formatPrice } from '../../lib/formatPrice';
import { empleadosService } from '../../services/empleadosService';
import { galeriaService } from '../../services/galeriaService';
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
      {/* El fade de los bordes son dos gradientes del color del fondo y no mask-image: la
          mascara — puesta sobre el mismo elemento que anima o sobre un ancestro quieto —
          congela la pista en los navegadores moviles (WebKit no recompone la zona
          enmascarada frame a frame, y en tactil el hover pegado la pausaba de golpe).
          Sobre un fondo plano el gradiente pinta exactamente lo mismo y la animacion
          queda libre de toda dependencia con la mascara. */}
      <div className="relative">
        <div aria-hidden="true" className="marquee-track flex w-max gap-5">
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
        {/* Mismo fade de 10% que la mascara de antes, pintado encima: como el fondo de la
            seccion es plano (--color-surface), el gradiente al color del fondo y la
            transparencia dan el mismo borroso de borde en los dos temas. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/10 bg-linear-to-r from-surface to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/10 bg-linear-to-l from-surface to-transparent"
        />
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

/**
 * Donde queda el negocio: a la izquierda la portada y el mapa, a la derecha el video.
 * Todo el contenido sale de ConfiguracionNegocio — la pagina no sabe donde queda el local
 * ni que video le puso, asi que mudarse o cambiar la portada no abre ningun `.tsx`.
 */
function DondeEstamos() {
  const { nombre, portadaUrl, videoPresentacionUrl, ubicacionMapsQuery } = configuracionPlaceholder;

  // El embed publico de Google Maps (output=embed) resuelve la busqueda sin API key ni
  // costo: lo que viaja en `q` es la ubicacion que configuro el negocio, y el mapa cae
  // en ese punto exacto, con su pin y su tarjeta de lugar.
  const mapaSrc = `https://www.google.com/maps?q=${encodeURIComponent(ubicacionMapsQuery)}&z=16&output=embed`;

  return (
    <section className="border-t border-border px-4 py-14 sm:py-18">
      <SeccionHeader
        eyebrow="Visitanos"
        titulo="Donde estamos ubicados"
        descripcion="Mira donde quedamos y como llegar antes de reservar tu cita."
      />

      <div className="mx-auto mt-10 grid max-w-5xl gap-4 stagger-in md:grid-cols-2 md:gap-6">
        {/* Columna izquierda: la portada arriba y el mapa debajo, apiladas en su propia
            columna para que el mapa crezca hasta el pie del video de la derecha. */}
        <div className="flex flex-col gap-4 md:gap-6">
          {/* Portada: la foto del local o, mientras no haya, el monograma del nombre —
              misma caida que una card de catalogo sin foto, para que la seccion no
              aparezca a medias. */}
          <div
            className={`${CARD_SHELL_CLASSES} relative aspect-video overflow-hidden shadow-xs shadow-black/5`}
          >
            <Thumbnail
              src={portadaUrl}
              fallback={nombre.charAt(0).toUpperCase()}
              alt={nombre}
              className="h-full w-full text-6xl"
            />
          </div>
          {/* Mapa: el iframe absoluto llena la card sin importar el alto que le deje la
              columna; el minimo es para que en movil no quede una franja chapa. */}
          <div className={`${CARD_SHELL_CLASSES} relative min-h-64 flex-1 overflow-hidden`}>
            <iframe
              title={`Ubicacion de ${nombre} en Google Maps`}
              src={mapaSrc}
              className="absolute inset-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        {/* Columna derecha: el video del negocio, o su lugar cuando todavia no cargaron
            uno — el contenedor existe desde ya, la seccion no cambia de forma al
            aparecer el video. */}
        <div className={`${CARD_SHELL_CLASSES} relative min-h-64 overflow-hidden shadow-xs shadow-black/5`}>
          {videoPresentacionUrl ? (
            <video
              src={videoPresentacionUrl}
              controls
              preload="metadata"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <IconoVideo className="size-10 text-accent-ink" />
              <p className="max-w-56 text-sm text-pretty text-text-muted">
                Pronto: un video del lugar para que lo conozcas antes de venir.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Adelanto de la galeria: las mismas fotos reales que `/galeria`, recortadas a las
 * primeras cuatro. Es un teaser y no una copia — si el catalogo todavia no tiene ninguna
 * imagen cargada, la seccion no aparece a medias (mismo criterio que `ServiciosMarquee`).
 */
function TrabajosDestacados() {
  const { terminoServicioPlural, terminoEmpleadoPlural } = configuracionPlaceholder;
  const servicios = useRecursoApi(() => serviciosService.list());
  const fotos = useRecursoApi(() => galeriaService.list());
  const empleados = useRecursoApi(() => empleadosService.list());

  if (
    servicios.cargando ||
    fotos.cargando ||
    empleados.cargando ||
    servicios.error ||
    fotos.error ||
    empleados.error
  ) {
    return null;
  }

  const items = construirGaleria(
    servicios.datos ?? [],
    fotos.datos ?? [],
    empleados.datos ?? [],
    terminoServicioPlural,
    terminoEmpleadoPlural,
  ).slice(0, 4);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border px-4 py-14 sm:py-18">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:gap-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Eyebrow tono="acento">Trabajos</Eyebrow>
            <h2 className="text-2xl text-balance sm:text-3xl">Un vistazo a lo ya hecho</h2>
          </div>
          <ButtonLink to="/galeria" variant="secondary">
            Ver la galeria
          </ButtonLink>
        </div>

        <div className="stagger-in grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {items.map((item) => (
            <Link key={item.id} to={item.to} className={`${CARD_MEDIA_INTERACTIVE_CLASSES} block`}>
              <div className="relative aspect-4/5">
                <Thumbnail
                  src={item.imagenUrl}
                  fallback={item.titulo.charAt(0).toUpperCase()}
                  className="h-full w-full text-3xl saturate-75 transition-[transform,filter] duration-300 group-hover:scale-105 group-hover:saturate-100"
                />
                <div className="foco-imagen pointer-events-none absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="line-clamp-1 text-sm font-semibold text-white">{item.titulo}</p>
                  <p className="line-clamp-1 text-xs text-white/80">{item.subtitulo}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
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
          <ButtonLink to="/equipo#servicios" variant="secondary" className="w-full sm:w-auto">
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
      <DondeEstamos />
      <TrabajosDestacados />
      <CierreCTA />
    </>
  );
}

import { useState } from 'react';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { EspecialistaCard } from '../../components/ui/EspecialistaCard';
import { Modal } from '../../components/ui/Modal';
import { ServicioCard } from '../../components/ui/ServicioCard';
import { StarIcon } from '../../components/ui/StarIcon';
import { Thumbnail } from '../../components/ui/Thumbnail';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { iniciales, nombreCompleto } from '../../lib/especialista';
import { formatDuration } from '../../lib/formatDuration';
import { formatFecha } from '../../lib/formatFecha';
import { formatPrice } from '../../lib/formatPrice';
import type { Especialista, Servicio } from '../../types/catalogo';

// TODO(spec 08): reemplazar por empleadosService.listPublico() y
// serviciosService.listPublico() cuando esos endpoints publicos existan (spec 03).
// Son dos peticiones independientes: cada seccion resuelve su propio Spinner/EmptyState.
// OJO: el rating y las resenas NO existen todavia en prisma/schema.prisma — hace falta un
// modelo Resena (autor, puntuacion, comentario, fecha, empleadoId) y que el endpoint
// publico devuelva el promedio y las ultimas tres ya calculados.
// Las filas sin imagen / sin rating estan a proposito, para ver los caminos vacios.
const ESPECIALISTAS: Especialista[] = [
  {
    id: '1',
    nombre: 'Joshua',
    apellido: 'Calero',
    especialidad: 'Barbero senior',
    fotoUrl: 'https://picsum.photos/seed/joshua/240/240',
    bio: 'Diez anios detras de la silla. Trabaja cortes clasicos y degradados, y atiende con cita previa de martes a sabado.',
    rating: {
      promedio: 4.8,
      total: 24,
      ultimasResenas: [
        {
          id: 'r1',
          autor: 'Marcela V.',
          puntuacion: 5,
          comentario: 'Puntual y muy prolijo. Explico que corte me quedaba mejor antes de empezar.',
          fecha: '2026-08-28',
        },
        {
          id: 'r2',
          autor: 'Diego S.',
          puntuacion: 5,
          comentario: 'El degradado quedo perfecto. Ya es la tercera vez que vuelvo.',
          fecha: '2026-08-14',
        },
        {
          id: 'r3',
          autor: 'Karla M.',
          puntuacion: 4,
          comentario: 'Muy buen resultado, aunque la cita arranco unos minutos tarde.',
          fecha: '2026-07-30',
        },
      ],
    },
  },
  {
    id: '2',
    nombre: 'Ana',
    apellido: 'Martinez',
    especialidad: 'Colorista',
    fotoUrl: 'https://picsum.photos/seed/ana/240/240',
    bio: 'Especialista en color y mechas. Hace diagnostico previo del cabello antes de proponer un tratamiento.',
    rating: {
      promedio: 4.9,
      total: 31,
      ultimasResenas: [
        {
          id: 'r4',
          autor: 'Lucia R.',
          puntuacion: 5,
          comentario: 'Me asesoro con el tono y acerto. El pelo quedo sanisimo.',
          fecha: '2026-09-01',
        },
        {
          id: 'r5',
          autor: 'Pablo N.',
          puntuacion: 5,
          comentario: 'Hizo prueba de mecha antes de aplicar. Se nota el cuidado.',
          fecha: '2026-08-22',
        },
        {
          id: 'r6',
          autor: 'Sofia T.',
          puntuacion: 4,
          comentario: 'Excelente color. La sesion fue larga, pero avisado desde el inicio.',
          fecha: '2026-08-05',
        },
      ],
    },
  },
  {
    id: '3',
    nombre: 'Luis',
    apellido: 'Rojas',
    especialidad: null,
    fotoUrl: null,
    bio: null,
    rating: null,
  },
];

const SERVICIOS: Servicio[] = [
  {
    id: '1',
    nombre: 'Corte y peinado',
    duracionMinutos: 45,
    precio: '12500',
    imagenUrl: 'https://picsum.photos/seed/corte/640/360',
    descripcion:
      'Lavado, corte a tijera o maquina y peinado final. Incluye asesoria de mantenimiento.',
  },
  {
    id: '2',
    nombre: 'Coloracion completa',
    duracionMinutos: 120,
    precio: '35000',
    imagenUrl: 'https://picsum.photos/seed/color/640/360',
    descripcion:
      'Aplicacion de color en todo el cabello, con prueba de mecha previa y tratamiento posterior.',
  },
  {
    id: '3',
    nombre: 'Barba',
    duracionMinutos: 20,
    precio: '6000',
    imagenUrl: null,
    descripcion: null,
  },
];

// spec/08: las dos rejillas son la misma a proposito. Una sola constante lo garantiza.
const GRID_CLASSES = 'stagger-in grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3';

// Encabezado de seccion: centrado, con una regla de acento corta debajo. Las dos
// secciones lo comparten para que se lean como parte de la misma pagina.
function SeccionHeader({ children, nivel }: { children: string; nivel: 1 | 2 }) {
  const Titulo = nivel === 1 ? 'h1' : 'h2';
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <Titulo
        className={
          nivel === 1
            ? 'text-3xl font-semibold tracking-tight md:text-4xl'
            : 'text-2xl font-semibold tracking-tight text-text-h md:text-3xl'
        }
      >
        {children}
      </Titulo>
      <span className="h-px w-12 bg-accent/60" aria-hidden="true" />
    </header>
  );
}

export function EquipoPage() {
  const { moneda, locale, terminoEmpleadoPlural, terminoServicioPlural } = configuracionPlaceholder;
  const [especialista, setEspecialista] = useState<Especialista | null>(null);
  const [servicio, setServicio] = useState<Servicio | null>(null);

  return (
    <div className="flex flex-col gap-16 py-6 sm:gap-24 sm:py-10">
      <section className="flex flex-col gap-8 sm:gap-10">
        <SeccionHeader nivel={1}>{terminoEmpleadoPlural}</SeccionHeader>
        <div className={GRID_CLASSES}>
          {ESPECIALISTAS.map((item) => (
            <EspecialistaCard
              key={item.id}
              especialista={item}
              onSelect={() => setEspecialista(item)}
            />
          ))}
        </div>
      </section>

      {/* scroll-mt deja aire bajo la navbar fija cuando se entra por #servicios. */}
      <section id="servicios" className="flex scroll-mt-24 flex-col gap-8 sm:gap-10">
        <SeccionHeader nivel={2}>{terminoServicioPlural}</SeccionHeader>
        <div className={GRID_CLASSES}>
          {SERVICIOS.map((item) => (
            <ServicioCard
              key={item.id}
              servicio={item}
              moneda={moneda}
              locale={locale}
              onSelect={() => setServicio(item)}
            />
          ))}
        </div>
      </section>

      <Modal
        open={especialista !== null}
        onClose={() => setEspecialista(null)}
        titulo={especialista ? nombreCompleto(especialista.nombre, especialista.apellido) : ''}
      >
        {especialista && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Thumbnail
                src={especialista.fotoUrl}
                fallback={iniciales(especialista.nombre, especialista.apellido)}
                className="h-16 w-16 rounded-full text-lg"
              />
              {especialista.especialidad && (
                <p className="text-sm font-medium text-text-muted">{especialista.especialidad}</p>
              )}
            </div>

            {especialista.bio && <p className="text-sm leading-relaxed">{especialista.bio}</p>}

            {especialista.rating && (
              <div className="flex flex-col gap-4 border-t border-border/70 pt-4">
                <div className="flex items-center gap-2.5">
                  <StarIcon className="h-7 w-7 shrink-0 text-price" />
                  <p className="text-3xl leading-none font-bold tracking-tight tabular-nums text-text-h">
                    {especialista.rating.promedio.toFixed(1)}
                  </p>
                  <p className="self-end text-xs text-text-muted">
                    {especialista.rating.total} resenas
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-center text-sm font-semibold tracking-tight text-text-h">
                    Ultimas Reseñas
                  </h3>
                  {/* Dos lineas por resena: autor y puntuacion comparten fila. Tres lineas
                      era lo que hacia ver esta seccion pesada en un telefono. */}
                  {especialista.rating.ultimasResenas.slice(0, 3).map((resena) => (
                    <div
                      key={resena.id}
                      className="flex flex-col gap-0.5 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-baseline gap-1.5 text-xs font-semibold text-text-h">
                          {resena.autor}
                          <span className="inline-flex items-center gap-0.5 font-bold text-price">
                            <StarIcon className="h-2.5 w-2.5 translate-y-px" />
                            <span className="tabular-nums">{resena.puntuacion.toFixed(1)}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-text-muted">
                          {formatFecha(resena.fecha, locale)}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{resena.comentario}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={servicio !== null}
        onClose={() => setServicio(null)}
        titulo={servicio?.nombre ?? ''}
      >
        {servicio && (
          <div className="flex flex-col gap-4">
            {servicio.imagenUrl && (
              <img
                src={servicio.imagenUrl}
                alt=""
                className="h-32 w-full rounded-lg bg-accent-bg object-cover sm:h-40"
              />
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="whitespace-nowrap text-sm text-text-muted">
                {formatDuration(servicio.duracionMinutos)}
              </span>
              <span className="text-xl font-bold tabular-nums text-price">
                {formatPrice(servicio.precio, moneda, locale)}
              </span>
            </div>
            {servicio.descripcion && (
              <p className="text-sm leading-relaxed">{servicio.descripcion}</p>
            )}
            <ButtonLink to="/citas/reservar" className="w-full">
              Agendar Cita
            </ButtonLink>
          </div>
        )}
      </Modal>
    </div>
  );
}

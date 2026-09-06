import { useState } from 'react';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { EspecialistaCard } from '../../components/ui/EspecialistaCard';
import { Modal } from '../../components/ui/Modal';
import { ServicioCard } from '../../components/ui/ServicioCard';
import { Thumbnail } from '../../components/ui/Thumbnail';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { iniciales, nombreCompleto } from '../../lib/especialista';
import { formatDuration } from '../../lib/formatDuration';
import { formatPrice } from '../../lib/formatPrice';

type Especialista = {
  id: string;
  nombre: string;
  apellido: string | null;
  especialidad: string | null;
  fotoUrl: string | null;
  bio: string | null;
};

type Servicio = {
  id: string;
  nombre: string;
  duracionMinutos: number;
  precio: string;
  imagenUrl: string | null;
  descripcion: string | null;
};

// TODO(spec 08): reemplazar por empleadosService.listPublico() y
// serviciosService.listPublico() cuando esos endpoints publicos existan (spec 03).
// Son dos peticiones independientes: cada seccion resuelve su propio Spinner/EmptyState.
// Las filas sin imagen estan a proposito, para ver el fallback de monograma.
const ESPECIALISTAS: Especialista[] = [
  {
    id: '1',
    nombre: 'Joshua',
    apellido: 'Calero',
    especialidad: 'Barbero senior',
    fotoUrl: 'https://picsum.photos/seed/joshua/240/240',
    bio: 'Diez anios detras de la silla. Trabaja cortes clasicos y degradados, y atiende con cita previa de martes a sabado.',
  },
  {
    id: '2',
    nombre: 'Ana',
    apellido: 'Martinez',
    especialidad: 'Colorista',
    fotoUrl: 'https://picsum.photos/seed/ana/240/240',
    bio: 'Especialista en color y mechas. Hace diagnostico previo del cabello antes de proponer un tratamiento.',
  },
  {
    id: '3',
    nombre: 'Luis',
    apellido: 'Rojas',
    especialidad: null,
    fotoUrl: null,
    bio: null,
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
const GRID_CLASSES = 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3';

export function EquipoPage() {
  const { moneda, locale, terminoEmpleadoPlural, terminoServicioPlural } = configuracionPlaceholder;
  const [especialista, setEspecialista] = useState<Especialista | null>(null);
  const [servicio, setServicio] = useState<Servicio | null>(null);

  return (
    <div className="flex flex-col gap-14 py-4">
      <section className="flex flex-col gap-5">
        <h1 className="text-2xl md:text-3xl">{terminoEmpleadoPlural}</h1>
        <div className={GRID_CLASSES}>
          {ESPECIALISTAS.map((item) => (
            <EspecialistaCard key={item.id} {...item} onSelect={() => setEspecialista(item)} />
          ))}
        </div>
      </section>

      <section id="servicios" className="flex flex-col gap-5">
        <h2 className="text-xl font-medium text-text-h md:text-2xl">{terminoServicioPlural}</h2>
        <div className={GRID_CLASSES}>
          {SERVICIOS.map((item) => (
            <ServicioCard
              key={item.id}
              {...item}
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
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Thumbnail
                src={especialista.fotoUrl}
                fallback={iniciales(especialista.nombre, especialista.apellido)}
                className="h-20 w-20 rounded-full text-xl"
              />
              {especialista.especialidad && (
                <p className="text-sm text-text-muted">{especialista.especialidad}</p>
              )}
            </div>
            {especialista.bio && <p className="text-sm leading-relaxed">{especialista.bio}</p>}
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
                className="h-40 w-full rounded-lg bg-accent-bg object-cover"
              />
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-text-muted">
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

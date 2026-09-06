import { ButtonLink } from '../../components/ui/ButtonLink';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';

// Copy de la pagina, no configuracion del negocio: no existe como campo en
// ConfiguracionNegocio y no tiene por que ser configurable.
const BAJADA = 'Elegi un horario y confirma al instante.';

// spec/06: si el negocio no cargo eslogan, el h1 cae a un titular neutro de rubro.
const TITULAR_NEUTRO = 'Reserva tu cita en minutos';

export function LandingPage() {
  const { nombre, eslogan, logoUrl, terminoEmpleadoPlural } = configuracionPlaceholder;

  return (
    <section className="flex flex-col items-center px-4 py-10 text-center">
      {logoUrl ? (
        <img src={logoUrl} alt={nombre} className="mb-3 max-h-14 w-auto md:max-h-18" />
      ) : (
        <span className="mb-3 text-xl font-semibold tracking-tight text-text-h md:text-2xl">
          {nombre}
        </span>
      )}
      <h1 className="mb-4 text-3xl md:text-4xl">{eslogan ?? TITULAR_NEUTRO}</h1>
      <p className="mb-8 max-w-sm text-text">{BAJADA}</p>
      <div className="flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <ButtonLink to="/citas/reservar" variant="primary" className="w-full sm:w-auto">
          Agendar Cita
        </ButtonLink>
        <ButtonLink to="/equipo" variant="secondary" className="w-full sm:w-auto">
          {terminoEmpleadoPlural}
        </ButtonLink>
      </div>
    </section>
  );
}

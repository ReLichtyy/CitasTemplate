import { useId, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ButtonLink } from '../ui/ButtonLink';
import { Dialogo } from '../ui/Dialogo';
import { Eyebrow } from '../ui/Eyebrow';

const ICON_CLASS = 'size-5.5 shrink-0';

function IconoInicio() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON_CLASS} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

function IconoServicios() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON_CLASS} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconoEquipo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON_CLASS} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.1 2.9-4.8 5.5-4.8s4.9 1.7 5.5 4.8" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 6.2M17.4 14.9c2 .5 3.4 2.1 3.9 4.6" />
    </svg>
  );
}

function IconoReservar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={ICON_CLASS} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

function IconoMas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={ICON_CLASS} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

function IconoChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-text-muted" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Barra bajo la pulgar: el punto solo se ve cuando la pestana esta activa. */
function Punto({ activo }: { activo: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`h-0.5 w-4 rounded-full transition-colors ${activo ? 'bg-accent' : 'bg-transparent'}`}
    />
  );
}

const TAB_CLASSES = (activa: boolean) =>
  `flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border focus-visible:ring-inset ${
    activa ? 'text-accent-ink' : 'text-text-muted hover:text-text-h'
  }`;

type Tab = { to: string; label: string; end?: boolean; icon: ReactNode };

const TABS: Tab[] = [
  { to: '/', label: 'Inicio', end: true, icon: <IconoInicio /> },
  { to: '/servicios', label: 'Servicios', icon: <IconoServicios /> },
  { to: '/equipo', label: 'Equipo', icon: <IconoEquipo /> },
  { to: '/citas/reservar', label: 'Reservar', icon: <IconoReservar /> },
];

const FILA_CLASSES =
  'flex min-h-13 w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 text-left text-sm font-medium text-text-h no-underline transition-colors hover:border-accent-border hover:bg-accent-bg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border';

/**
 * Navegacion inferior de telefono: reemplaza al menu hamburguesa por debajo de `md`.
 *
 * Cuatro destinos fijos mas "Mas", que abre una hoja con lo que no entra en cuatro
 * pestanas — el catalogo de productos, las citas propias con sesion y el enlace de
 * gestion para quien tiene el rol. Sin sesion, la hoja ademas ofrece entrar: el boton de
 * iniciar sesion de la cabecera queda, pero repetirlo aqui evita que alguien sin cuenta
 * tenga que subir a buscarlo.
 */
export function BottomNav() {
  const { isAuthenticated, rol } = useAuth();
  const [masAbierto, setMasAbierto] = useState(false);
  const tituloId = useId();
  const isGestion = rol === 'ADMIN' || rol === 'EMPLEADO';

  const cerrarMas = () => setMasAbierto(false);

  return (
    <>
      <nav
        aria-label="Navegacion principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        {TABS.map(({ to, label, end, icon }) => (
          <NavLink key={to} to={to} end={end} onClick={cerrarMas} className="no-underline">
            {({ isActive }) => (
              <span className={TAB_CLASSES(isActive)}>
                {icon}
                <span className="text-[11px] font-medium">{label}</span>
                <Punto activo={isActive} />
              </span>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMasAbierto(true)}
          aria-haspopup="dialog"
          aria-expanded={masAbierto}
          className={TAB_CLASSES(masAbierto)}
        >
          <IconoMas />
          <span className="text-[11px] font-medium">Mas</span>
          <Punto activo={masAbierto} />
        </button>
      </nav>

      <Dialogo
        open={masAbierto}
        onClose={cerrarMas}
        tituloId={tituloId}
        variant="hoja"
        className="sm:max-w-sm"
      >
        <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow className="m-0" id={tituloId}>
              Mas
            </Eyebrow>
            <button
              type="button"
              onClick={cerrarMas}
              aria-label="Cerrar"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text transition-colors hover:text-text-h focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <NavLink to="/galeria" onClick={cerrarMas} className={FILA_CLASSES}>
              Galeria
              <IconoChevron />
            </NavLink>
            <NavLink to="/productos" onClick={cerrarMas} className={FILA_CLASSES}>
              Productos
              <IconoChevron />
            </NavLink>
            {isAuthenticated && (
              <NavLink to="/citas" onClick={cerrarMas} className={FILA_CLASSES}>
                Sus citas
                <IconoChevron />
              </NavLink>
            )}
            {isGestion && (
              <NavLink to="/gestion/servicios" onClick={cerrarMas} className={FILA_CLASSES}>
                Gestion
                <IconoChevron />
              </NavLink>
            )}
          </div>

          {!isAuthenticated && (
            <ButtonLink to="/auth/login" onClick={cerrarMas} className="w-full">
              Iniciar sesion
            </ButtonLink>
          )}
        </div>
      </Dialogo>
    </>
  );
}

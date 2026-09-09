import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { ButtonLink } from '../ui/ButtonLink';
import { MarcaNegocio } from '../ui/MarcaNegocio';

// El borde inferior queda siempre presente (transparente en reposo) para que ganar el
// acento en hover/activo no mueva el link un pixel hacia arriba.
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 pb-0.5 text-sm font-medium transition-colors ${isActive ? 'border-accent text-accent' : 'border-transparent text-text hover:border-accent-border hover:text-text-h'}`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 w-full items-center justify-center text-base font-medium transition-colors ${isActive ? 'text-accent' : 'text-text hover:text-text-h'}`;

export type Enlace = { to: string; label: string; end?: boolean };

// Compartida con Footer: el pie repite la misma navegacion publica, no una propia.
export const ENLACES_PUBLICOS: Enlace[] = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/equipo', label: 'Equipo' },
  { to: '/productos', label: 'Productos' },
  { to: '/citas/reservar', label: 'Reservar' },
];

export function Navbar() {
  const { isAuthenticated, rol, logout } = useAuth();
  const location = useLocation();
  const [menuState, setMenuState] = useState({ open: false, pathname: location.pathname });
  const isGestion = rol === 'ADMIN' || rol === 'EMPLEADO';

  if (menuState.pathname !== location.pathname) {
    setMenuState({ open: false, pathname: location.pathname });
  }

  const menuOpen = menuState.open;
  const setMenuOpen = (open: boolean | ((prev: boolean) => boolean)) =>
    setMenuState((state) => ({
      ...state,
      open: typeof open === 'function' ? open(state.open) : open,
    }));
  const closeMenu = () => setMenuOpen(false);

  // Una sola lista: escritorio y menu movil renderizan lo mismo y no pueden desincronizarse.
  const enlaces: Enlace[] = [
    ...ENLACES_PUBLICOS,
    ...(isAuthenticated ? [{ to: '/citas', label: 'Citas' }] : []),
    ...(isAuthenticated ? [{ to: '/auth/perfil', label: 'Mi perfil' }] : []),
    ...(isGestion ? [{ to: '/gestion/servicios', label: 'Gestion' }] : []),
  ];

  const botonSesion = (className = '') =>
    isAuthenticated ? (
      <Button
        variant="secondary"
        className={className}
        onClick={() => {
          logout();
          closeMenu();
        }}
      >
        Cerrar sesion
      </Button>
    ) : (
      <ButtonLink to="/auth/login" className={className} onClick={closeMenu}>
        Iniciar sesion
      </ButtonLink>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        {/* La marca sale de ConfiguracionNegocio: "CitasTemplate" es el nombre del
            repositorio, no el del negocio. Ver 05-marca-y-responsive.md. */}
        <NavLink to="/" className="no-underline transition-colors hover:text-accent">
          <MarcaNegocio
            imgClassName="max-h-8 w-auto"
            textClassName="font-heading text-xl font-normal tracking-tight text-text-h transition-colors hover:text-accent"
          />
        </NavLink>

        <div className="hidden flex-1 items-center justify-center gap-6 md:flex">
          {enlaces.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              {label}
            </NavLink>
          ))}
        </div>

        <div className="hidden md:block">{botonSesion()}</div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="navbar-mobile-menu"
          aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-text-h transition-[background-color,transform] duration-150 ease-out hover:bg-accent-bg active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border focus-visible:ring-offset-2 focus-visible:ring-offset-bg md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            {menuOpen ? <path d="M6 6l12 12M18 6l-12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {menuOpen && (
        <div id="navbar-mobile-menu" className="border-t border-border px-6 py-4 md:hidden">
          <div className="flex flex-col items-center gap-1">
            {enlaces.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={mobileLinkClass} onClick={closeMenu}>
                {label}
              </NavLink>
            ))}
            <div className="mt-3 w-full">{botonSesion('w-full')}</div>
          </div>
        </div>
      )}
    </header>
  );
}

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${isActive ? 'text-accent' : 'text-text hover:text-text-h'}`;

export function Navbar() {
  const { isAuthenticated, role, logout } = useAuth();
  const isGestion = role === 'admin' || role === 'empleado';

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <NavLink to="/" className="text-lg font-semibold text-text-h no-underline">
          CitasTemplate
        </NavLink>

        <div className="flex flex-1 items-center gap-6">
          <NavLink to="/" end className={linkClass}>
            Inicio
          </NavLink>
          <NavLink to="/servicios" className={linkClass}>
            Servicios
          </NavLink>
          <NavLink to="/equipo" className={linkClass}>
            Equipo
          </NavLink>
          <NavLink to="/citas/reservar" className={linkClass}>
            Reservar
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/citas" className={linkClass}>
              Citas
            </NavLink>
          )}
          {isGestion && (
            <NavLink to="/gestion/servicios" className={linkClass}>
              Gestion
            </NavLink>
          )}
        </div>

        {isAuthenticated ? (
          <Button variant="secondary" onClick={logout}>
            Cerrar sesion
          </Button>
        ) : (
          <NavLink
            to="/auth/login"
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-medium text-white no-underline transition-colors hover:opacity-90"
          >
            Iniciar sesion
          </NavLink>
        )}
      </nav>
    </header>
  );
}

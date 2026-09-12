import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Rol } from '../../services/authService';
import { ButtonLink } from '../ui/ButtonLink';
import { MarcaNegocio } from '../ui/MarcaNegocio';
import { PerfilModal, inicialesDe } from '../ui/PerfilModal';

// El borde inferior queda siempre presente (transparente en reposo) para que ganar el
// acento en hover/activo no mueva el link un pixel hacia arriba.
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 pb-0.5 text-sm font-medium transition-colors ${isActive ? 'border-accent text-accent-ink' : 'border-transparent text-text hover:border-accent-border hover:text-text-h'}`;

export type Enlace = { to: string; label: string; end?: boolean };

// Compartida con Footer: el pie repite la misma navegacion publica, no una propia.
export const ENLACES_PUBLICOS: Enlace[] = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/equipo', label: 'Equipo' },
  { to: '/galeria', label: 'Galeria' },
  { to: '/productos', label: 'Productos' },
  { to: '/citas/reservar', label: 'Reservar' },
];

/**
 * Accesos directos por dominio, para no obligar a quien gestiona a entrar siempre por
 * `/gestion/servicios` y navegar desde ahi. Productos queda fuera para EMPLEADO: en el
 * API hasta la *lectura* de `/productos/gestion` es `Roles(ADMIN)` (ver CLAUDE.md), asi
 * que un enlace aqui solo le mostraria un 403.
 */
function enlacesGestionPara(rol: Rol): Enlace[] {
  const base: Enlace[] = [
    { to: '/citas/agenda', label: 'Agenda' },
    { to: '/gestion/servicios', label: 'Servicios' },
    { to: '/gestion/empleados', label: 'Empleados' },
    { to: '/gestion/adicionales', label: 'Adicionales' },
    { to: '/gestion/horarios', label: 'Horarios' },
    { to: '/gestion/restricciones', label: 'Restricciones' },
  ];
  return rol === 'ADMIN' ? [...base, { to: '/gestion/productos', label: 'Productos' }] : base;
}

/**
 * "Gestion" como desplegable y no como un solo link: sin esto, quien administra siempre
 * entraba por `/gestion/servicios` y navegaba desde ahi a los demas dominios.
 */
function MenuGestion({ rol }: { rol: Rol }) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const enlaces = enlacesGestionPara(rol);

  // Clic afuera o Escape cierran el menu: es un desplegable de navegacion, no un dialogo
  // modal, asi que no bloquea el resto de la pagina mientras esta abierto.
  useEffect(() => {
    if (!abierto) {
      return;
    }
    const alHacerClic = (evento: MouseEvent) => {
      if (!contenedorRef.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    };
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', alHacerClic);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alHacerClic);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={`inline-flex items-center gap-1.5 border-b-2 pb-0.5 text-sm font-medium transition-colors ${
          abierto
            ? 'border-accent text-accent-ink'
            : 'border-transparent text-text hover:border-accent-border hover:text-text-h'
        }`}
      >
        Gestion
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-3.5 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute top-full left-1/2 z-50 mt-2 w-56 -translate-x-1/2 rounded-xl border border-border bg-surface p-1.5 shadow-lg shadow-black/10"
        >
          {enlaces.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              role="menuitem"
              onClick={() => setAbierto(false)}
              className={({ isActive }) =>
                `flex min-h-10 items-center rounded-lg px-3 text-sm no-underline transition-colors ${
                  isActive
                    ? 'bg-accent-bg text-text-h'
                    : 'text-text hover:bg-accent-bg hover:text-text-h'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Cabecera de la app.
 *
 * De `md` para arriba lleva la navegacion completa, como siempre. Por debajo, `BottomNav`
 * es la navegacion principal (fija al pie, con "Mas" para el resto), asi que aqui solo
 * quedan la marca y el boton de cuenta — la cabecera del telefono es angosta y repetir la
 * lista entera en un menu hamburguesa competia con la barra de abajo por el mismo trabajo.
 */
export function Navbar() {
  const { isAuthenticated, rol, usuario, logout } = useAuth();
  const [perfilAbierto, setPerfilAbierto] = useState(false);

  // Una sola lista para escritorio: `BottomNav` arma la suya para telefono. "Gestion" no
  // entra aqui: es un desplegable propio (`MenuGestion`), no un link mas.
  const enlaces: Enlace[] = [
    ...ENLACES_PUBLICOS,
    ...(isAuthenticated ? [{ to: '/citas', label: 'Citas' }] : []),
    // "Mi perfil" no esta aqui: vive en `PerfilModal`, detras del boton de cuenta. Un
    // enlace mas en la barra para lo mismo solo compite con la navegacion del negocio.
  ];

  /**
   * Con sesion, un boton de cuenta con las iniciales que abre `PerfilModal`; sin ella, el
   * mismo enlace de entrar de siempre.
   *
   * **Cerrar sesion ya no vive aqui**: se movio dentro del modal. Ocupaba sitio permanente
   * en la barra para algo que se usa una vez por sesion, y estaba pegado a los enlaces de
   * navegacion — el peor vecino para lo unico que destruye estado.
   *
   * `usuario` puede tardar en llegar (`AuthProvider` lo pide al arrancar), asi que hasta
   * entonces no se pinta el boton: unas iniciales que cambian solas al segundo se leen como
   * un fallo. El hueco es de un ancho fijo para que la barra no salte al llenarse.
   */
  const botonSesion = () => {
    if (!isAuthenticated) {
      return (
        <ButtonLink to="/auth/login" className="min-h-10 px-4 py-2 text-sm">
          Iniciar sesion
        </ButtonLink>
      );
    }
    if (!usuario) {
      return <span className="inline-block size-11" aria-hidden="true" />;
    }
    return (
      <button
        type="button"
        onClick={() => setPerfilAbierto(true)}
        aria-haspopup="dialog"
        aria-label={`Cuenta de ${usuario.nombre}`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-text-h transition-[background-color,border-color] duration-150 hover:border-accent-border hover:bg-accent-bg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border"
      >
        {inicialesDe(usuario)}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        {/* La marca sale de ConfiguracionNegocio: "CitasTemplate" es el nombre del
            repositorio, no el del negocio. Ver 05-marca-y-responsive.md. */}
        <NavLink to="/" className="no-underline transition-colors hover:text-accent-ink">
          <MarcaNegocio
            imgClassName="max-h-8 w-auto"
            textClassName="font-heading text-xl font-normal tracking-tight text-text-h transition-colors hover:text-accent-ink"
          />
        </NavLink>

        <div className="hidden flex-1 items-center justify-center gap-6 md:flex">
          {enlaces.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              {label}
            </NavLink>
          ))}
          {(rol === 'ADMIN' || rol === 'EMPLEADO') && <MenuGestion rol={rol} />}
        </div>

        {botonSesion()}
      </nav>

      {usuario && (
        <PerfilModal
          usuario={usuario}
          abierto={perfilAbierto}
          onCerrar={() => setPerfilAbierto(false)}
          onSalir={() => {
            setPerfilAbierto(false);
            logout();
          }}
        />
      )}
    </header>
  );
}

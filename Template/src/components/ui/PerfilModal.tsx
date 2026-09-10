import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button';
import { Dialogo } from './Dialogo';
import type { Rol, UsuarioActual } from '../../services/authService';

/** Como se llama cada rol de cara al usuario. `ADMIN` no es texto de interfaz. */
const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administracion',
  EMPLEADO: 'Equipo',
  CLIENTE: 'Cliente',
};

/**
 * Iniciales para el boton de cuenta. Nombre y apellido cuando hay los dos; si no, las dos
 * primeras letras del nombre — una sola inicial en un circulo se lee como un error.
 */
export function inicialesDe(usuario: UsuarioActual): string {
  const nombre = usuario.nombre.trim();
  const apellido = usuario.apellido?.trim();
  if (apellido) {
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  }
  return nombre.slice(0, 2).toUpperCase();
}

export function nombreCompletoDe(usuario: UsuarioActual): string {
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ');
}

/**
 * Vista rapida de la cuenta: quien es, con que numero entro, y las dos cosas que se hacen
 * desde aqui — abrir el perfil o salir.
 *
 * **Cerrar sesion vive aqui y no en la barra.** En la barra ocupaba sitio permanente para
 * algo que se usa una vez por sesion, y quedaba pegado a los enlaces de navegacion, que es
 * donde no debe estar lo unico que destruye estado.
 *
 * El telefono se muestra entero a proposito: es la credencial con la que se entra
 * (SPEC.md), y quien tiene varias fichas necesita ver con cual esta dentro. Ya se esta
 * detras de una sesion, asi que no revela nada que el portador no sepa.
 */
export function PerfilModal({
  usuario,
  abierto,
  onCerrar,
  onSalir,
}: {
  usuario: UsuarioActual;
  abierto: boolean;
  onCerrar: () => void;
  onSalir: () => void;
}) {
  const tituloId = useId();

  return (
    <Dialogo open={abierto} onClose={onCerrar} tituloId={tituloId} className="max-w-xs">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-accent-border bg-accent-bg text-sm font-semibold text-accent"
          >
            {inicialesDe(usuario)}
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 id={tituloId} className="truncate text-lg">
              {nombreCompletoDe(usuario)}
            </h2>
            <span className="text-xs text-text-muted">{ETIQUETA_ROL[usuario.rol]}</span>
          </div>
        </div>

        <dl className="flex flex-col gap-2 rounded-lg bg-bg p-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-text-muted">Nombre</dt>
            <dd className="m-0 truncate text-text-h">{usuario.nombre}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-text-muted">Apellido</dt>
            {/* El guion y no un hueco: un valor vacio sin marca parece que no cargo. */}
            <dd className="m-0 truncate text-text-h">{usuario.apellido || '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-2">
            <dt className="shrink-0 text-text-muted">Telefono</dt>
            <dd className="m-0 truncate font-medium tabular-nums text-text-h">
              {usuario.telefono}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <Link
            to="/auth/perfil"
            onClick={onCerrar}
            className="flex min-h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-semibold text-text-h no-underline transition-colors hover:border-accent-border hover:bg-accent-bg"
          >
            Mi perfil
          </Link>
          <Button variant="secondary" onClick={onSalir}>
            Cerrar sesion
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}

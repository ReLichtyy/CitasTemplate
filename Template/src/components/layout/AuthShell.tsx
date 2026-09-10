import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
import { Eyebrow } from '../ui/Eyebrow';

/**
 * El armazon de las pantallas de cuenta: entrar, registrarse y el perfil.
 *
 * Existe porque las tres se habian escrito por separado y se habian separado: una a
 * `max-w-md` y otra a `max-w-2xl`, una con `PageHeader` y otra con un `h1` suelto, la
 * bajada a veces arriba del titulo y a veces debajo. Son la misma familia de pantallas y
 * ahora lo parecen, sin que cada una tenga que acordarse de como.
 *
 * `ancho` es lo unico que se decide por pantalla: un formulario de una columna se lee mal
 * estirado, y el perfil necesita dos. Nada mas es configurable a proposito.
 */
export function AuthShell({
  eyebrow,
  titulo,
  descripcion,
  /** `estrecho` para un formulario de una columna; `ancho` para una rejilla de dos. */
  ancho = 'estrecho',
  /**
   * Envolver el contenido en una `Card`. Es lo normal —una pantalla de cuenta es un
   * formulario—, pero una pantalla con **varias** secciones trae sus propias cards y
   * anidarlas dentro de otra da un marco dentro de un marco. Ahi se apaga.
   */
  enCard = true,
  children,
  /** Bajo la card: el enlace a la otra pantalla de cuenta. */
  pie,
}: {
  eyebrow?: string;
  titulo: string;
  descripcion?: ReactNode;
  ancho?: 'estrecho' | 'ancho';
  enCard?: boolean;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <main
      className={`mx-auto flex w-full flex-col gap-6 py-6 sm:py-10 ${
        ancho === 'ancho' ? 'max-w-2xl' : 'max-w-md'
      }`}
    >
      <header className="flex flex-col gap-2">
        {eyebrow && <Eyebrow tono="acento">{eyebrow}</Eyebrow>}
        {/* Sin `font-heading ...`: index.css ya se los aplica a todo h1. */}
        <h1 className="text-3xl">{titulo}</h1>
        {descripcion && <p className="m-0 text-sm text-pretty text-text">{descripcion}</p>}
      </header>

      {enCard ? <Card>{children}</Card> : children}

      {pie && <p className="m-0 text-center text-sm text-text">{pie}</p>}
    </main>
  );
}

import { NavLink } from 'react-router-dom';
import { ButtonLink } from '../ui/ButtonLink';
import { Eyebrow } from '../ui/Eyebrow';
import { MarcaNegocio } from '../ui/MarcaNegocio';
import { configuracionPlaceholder } from '../../lib/configuracionPlaceholder';
import { ENLACES_PUBLICOS } from './Navbar';

// Cada bloque se separa con una linea propia mientras estan apilados, y esa linea
// desaparece cuando pasan a columnas: en una fila, un borde superior por columna es
// ruido. `first:` evita la linea de arriba, que duplicaria el borde del pie.
const BLOQUE_CLASSES = 'border-t border-border pt-8 first:border-t-0 first:pt-0 sm:border-t-0 sm:pt-0';

// El enlace del pie es un objetivo tactil, no una linea de texto: de ahi el `min-h-11`.
// La marca de hover es un subrayado que crece **debajo** del texto y no un guion delante:
// cualquier cosa puesta antes del texto lo corre hacia la derecha y desalinea la columna
// respecto de su eyebrow. Se muestra tambien en foco: el teclado ve lo mismo.
const ENLACE_CLASSES =
  'group relative -mx-2 inline-flex min-h-11 w-fit items-center rounded-md px-2 text-sm text-text transition-colors hover:text-text-h focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border';

export function Footer() {
  const { eslogan } = configuracionPlaceholder;

  return (
    <footer className="relative border-t border-border bg-surface">
      {/* Filo de luz sobre el borde: el pie es el unico corte a todo lo ancho de la app y
          esto lo vuelve un cierre en vez de una linea mas. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent-border to-transparent"
      />

      {/*
        Tres tramos de ancho, no dos:
        - telefono, una columna apilada en orden de importancia;
        - `sm`, la marca ocupa el ancho y navegacion y reservas se reparten abajo — con
          tres bloques en dos columnas, la tercera quedaba sola en una fila a medias;
        - `lg`, las tres en fila, con la marca mas ancha porque lleva el eslogan.
      */}
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-[1.5fr_1fr_1fr] lg:gap-x-12 lg:py-14">
        {/* En dos columnas la marca es un tramo propio y lleva regla abajo; en tres es
            una columna mas y la regla sobra. */}
        <div
          className={`${BLOQUE_CLASSES} flex flex-col gap-3 sm:col-span-2 sm:border-b sm:border-border sm:pb-8 lg:col-span-1 lg:border-b-0 lg:pb-0`}
        >
          <MarcaNegocio
            imgClassName="max-h-10 w-auto"
            textClassName="font-heading text-2xl font-normal tracking-tight text-text-h"
          />
          {eslogan && <p className="max-w-xs text-sm text-pretty text-text-muted">{eslogan}</p>}
        </div>

        <nav aria-label="Navegacion del pie" className={`${BLOQUE_CLASSES} flex flex-col`}>
          <Eyebrow className="mb-2">Navegacion</Eyebrow>
          {ENLACES_PUBLICOS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={ENLACE_CLASSES}>
              {label}
              <span
                aria-hidden="true"
                className="absolute inset-x-2 bottom-2.5 h-px origin-left scale-x-0 bg-accent transition-transform duration-200 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
              />
            </NavLink>
          ))}
        </nav>

        <div className={`${BLOQUE_CLASSES} flex flex-col items-start gap-3`}>
          <Eyebrow>Reservas</Eyebrow>
          <p className="text-sm text-pretty text-text-muted">
            Elegi horario y confirma. Sin llamadas y sin crear cuenta.
          </p>
          {/* A ancho completo en telefono: es la unica accion del pie y ahi el pulgar
              agradece el ancho; desde `sm` vuelve a medir lo que dice. */}
          <ButtonLink to="/citas/reservar" variant="secondary" className="w-full sm:w-auto">
            Agendar cita
          </ButtonLink>
        </div>
      </div>

      {/* Barra meta: tamano caption, todo mayuscula con tracking abierto, como el resto de
          los eyebrows del sistema. */}
      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-4 text-xs tracking-wide text-text-muted uppercase sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-2">
            <span>&copy; {new Date().getFullYear()}</span>
            <MarcaNegocio imgClassName="max-h-4 w-auto" />
          </p>
          {/* `scrollTo` sin `behavior` toma el `scroll-behavior` de la hoja, que ya es
              suave y que `prefers-reduced-motion` apaga: el respeto por esa preferencia
              queda en un solo lugar en vez de repetirse aqui. */}
          <button
            type="button"
            onClick={() => window.scrollTo(0, 0)}
            className="group -mx-2 inline-flex min-h-11 items-center gap-2 self-start rounded-md px-2 text-xs tracking-wide uppercase transition-colors hover:text-text-h focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-border sm:self-auto"
          >
            Volver arriba
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5"
              aria-hidden="true"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
}

import { Button } from './Button';

/**
 * Anterior / siguiente con el conteo en medio.
 *
 * Sin numeros de pagina a proposito: el API pagina por desplazamiento, y una agenda que
 * crece por arriba hace que la "pagina 7" de hace un minuto ya no sea la misma. Lo que si
 * es cierto siempre es cuantas hay en total, porque el API lo cuenta con el mismo filtro
 * que la pagina y en la misma transaccion.
 *
 * `pagina` es base cero, como en el API, para que no haya un +1 escondido en el camino.
 */
export function Paginacion({
  pagina,
  limite,
  total,
  onCambiar,
  deshabilitado = false,
}: {
  pagina: number;
  limite: number;
  total: number;
  onCambiar: (pagina: number) => void;
  /** Mientras la peticion anterior sigue en vuelo. */
  deshabilitado?: boolean;
}) {
  const primero = pagina * limite;
  const ultimo = Math.min(primero + limite, total);
  const hayAnterior = pagina > 0;
  const haySiguiente = ultimo < total;

  // Con todo en una sola pagina no hay nada que navegar y los dos botones estarian
  // apagados: el bloque entero sobra.
  if (!hayAnterior && !haySiguiente) {
    return null;
  }

  return (
    <nav
      aria-label="Paginacion de citas"
      className="flex items-center justify-between gap-4 border-t border-border pt-4"
    >
      <Button
        variant="secondary"
        className="min-h-11 px-4 py-2"
        onClick={() => onCambiar(pagina - 1)}
        disabled={!hayAnterior || deshabilitado}
      >
        Anterior
      </Button>

      {/* `aria-live`: al cambiar de pagina el foco sigue en el boton, asi que sin esto un
          lector de pantalla no anuncia que el rango cambio. */}
      <p aria-live="polite" className="m-0 text-sm tabular-nums text-text">
        {primero + 1}–{ultimo} de {total}
      </p>

      <Button
        variant="secondary"
        className="min-h-11 px-4 py-2"
        onClick={() => onCambiar(pagina + 1)}
        disabled={!haySiguiente || deshabilitado}
      >
        Siguiente
      </Button>
    </nav>
  );
}

import { Button } from './Button';
import { Field } from './Field';

export type Rango = { desde: string; hasta: string };

export const RANGO_VACIO: Rango = { desde: '', hasta: '' };

/**
 * Filtro de dos fechas, en `YYYY-MM-DD` (lo que produce un `<input type="date">`).
 *
 * Guarda el rango como lo escribio el usuario y deja que quien lo consume lo traduzca a
 * los instantes ISO que espera el API (`lib/formatFechaHora`, `limiteDelDia`). Mezclar las
 * dos cosas aqui obligaria a convertir de ida y vuelta en cada tecla.
 *
 * Los dos extremos son opcionales por separado: "de aqui en adelante" y "hasta tal dia"
 * son consultas normales en una agenda, y el API acepta cada uno por su cuenta.
 */
export function RangoFechas({
  valor,
  onCambiar,
  onLimpiar,
  deshabilitado = false,
}: {
  valor: Rango;
  onCambiar: (rango: Rango) => void;
  onLimpiar: () => void;
  deshabilitado?: boolean;
}) {
  const hayFiltro = valor.desde !== '' || valor.hasta !== '';
  // Un rango al reves no devuelve nada y el API lo aceptaria sin quejarse: se avisa aqui,
  // que es donde se puede corregir, en vez de mostrar una lista vacia que parece un fallo.
  const invertido = valor.desde !== '' && valor.hasta !== '' && valor.hasta < valor.desde;

  return (
    <search className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Desde"
          type="date"
          value={valor.desde}
          max={valor.hasta || undefined}
          disabled={deshabilitado}
          wrapperClassName="min-w-40 flex-1"
          onChange={(evento) => onCambiar({ ...valor, desde: evento.target.value })}
        />
        <Field
          label="Hasta"
          type="date"
          value={valor.hasta}
          min={valor.desde || undefined}
          disabled={deshabilitado}
          wrapperClassName="min-w-40 flex-1"
          onChange={(evento) => onCambiar({ ...valor, hasta: evento.target.value })}
        />
        {hayFiltro && (
          <Button
            variant="secondary"
            className="min-h-11 px-4 py-2"
            onClick={onLimpiar}
            disabled={deshabilitado}
          >
            Limpiar
          </Button>
        )}
      </div>

      {invertido && (
        <p role="alert" className="m-0 text-xs font-medium text-danger">
          La fecha final es anterior a la inicial.
        </p>
      )}
    </search>
  );
}

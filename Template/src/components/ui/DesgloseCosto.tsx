import { formatPrice } from '../../lib/formatPrice';
import type { Cita } from '../../types/cita';

/**
 * De donde sale el total de una cita.
 *
 * Los tres importes vienen calculados del servidor (`precioServicio`, `costoAdicionales`,
 * `costoTotal`) y **aqui no se suma nada**: mostrar una suma propia seria una segunda
 * fuente de verdad sobre el precio, y la primera vez que difiera un centimo el cliente
 * cree la de la pantalla. Ver `02-reservas-concurrencia.md`.
 *
 * Los precios de los adicionales son los del join, congelados al reservar: si el negocio
 * sube la tarifa, esta ficha sigue mostrando lo que se cobro.
 */
export function DesgloseCosto({
  cita,
  moneda,
  locale,
}: {
  cita: Cita;
  moneda: string;
  locale: string;
}) {
  const hayAdicionales = cita.adicionales.length > 0;

  return (
    <dl className="flex flex-col gap-2 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-text">{cita.servicio.nombre}</dt>
        <dd className="m-0 shrink-0 tabular-nums text-text-h">
          {formatPrice(cita.precioServicio, moneda, locale)}
        </dd>
      </div>

      {cita.adicionales.map((linea) => (
        <div key={linea.adicionalId} className="flex items-baseline justify-between gap-4">
          <dt className="text-text">{linea.adicional.nombre}</dt>
          <dd className="m-0 shrink-0 tabular-nums text-text-h">
            {formatPrice(linea.precio, moneda, locale)}
          </dd>
        </div>
      ))}

      {/* Con adicionales el subtotal explica de donde sale la diferencia; sin ellos seria
          repetir el precio del servicio tres veces. */}
      {hayAdicionales && (
        <div className="flex items-baseline justify-between gap-4 text-text-muted">
          <dt>Adicionales</dt>
          <dd className="m-0 shrink-0 tabular-nums">
            {formatPrice(cita.costoAdicionales, moneda, locale)}
          </dd>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2">
        <dt className="font-semibold text-text-h">Total</dt>
        <dd className="m-0 shrink-0 text-base font-semibold tabular-nums text-price">
          {formatPrice(cita.costoTotal, moneda, locale)}
        </dd>
      </div>
    </dl>
  );
}

import { useId, useState } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { CAMPO_CLASSES } from './Field';
import { Dialogo } from './Dialogo';
import { formatFechaHora } from '../../lib/formatFechaHora';
import type { Cita } from '../../types/cita';

/** Lo mismo que topa `CancelarCitaDto.motivo` en el API. Ver `cancelar-cita.dto.ts`. */
const MAX_MOTIVO = 255;

/**
 * Confirmacion para cancelar una cita, con motivo opcional.
 *
 * Se pregunta porque cancelar no se deshace desde la interfaz: el estado pasa a CANCELADA,
 * el espacio se libera y quien lo quiera de vuelta tiene que reservar otra vez, y para
 * entonces el hueco puede estar tomado. Un dialogo es barato comparado con eso.
 *
 * El motivo es opcional a proposito: exigirlo produce "asdf". Cuando lo escriben, es lo
 * que el negocio lee despues para entender un patron de cancelaciones.
 */
export function DialogoCancelar({
  cita,
  abierto,
  onCerrar,
  onConfirmar,
  enviando,
  error,
  locale,
}: {
  cita: Cita;
  abierto: boolean;
  onCerrar: () => void;
  /** Recibe el motivo ya recortado, o `undefined` si quedo vacio. */
  onConfirmar: (motivo?: string) => void;
  enviando: boolean;
  error: string | null;
  locale: string;
}) {
  const tituloId = useId();
  const [motivo, setMotivo] = useState('');

  const cerrar = () => {
    if (enviando) {
      return;
    }
    setMotivo('');
    onCerrar();
  };

  return (
    <Dialogo open={abierto} onClose={cerrar} tituloId={tituloId} className="max-w-md">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id={tituloId} className="text-xl">
            Cancelar esta cita?
          </h2>
          <p className="m-0 text-sm text-text">
            {cita.servicio.nombre}, {formatFechaHora(cita.inicio, locale)}. El espacio queda
            libre para otra persona y no se puede deshacer desde aqui.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm text-text">
          Motivo (opcional)
          <textarea
            rows={3}
            maxLength={MAX_MOTIVO}
            value={motivo}
            disabled={enviando}
            placeholder="Por ejemplo: el cliente aviso que no puede llegar."
            onChange={(evento) => setMotivo(evento.target.value)}
            className={`${CAMPO_CLASSES} min-h-20 resize-y py-2`}
          />
        </label>

        {/* El texto sale del API. El caso que importa es el 409: un estado que ya no
            admite cancelacion (otra pestana la cancelo primero, o el negocio la cerro). */}
        {error && <Alert>{error}</Alert>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={cerrar} disabled={enviando}>
            Volver
          </Button>
          {/* Contorno y no relleno: no hay token de texto sobre `--color-danger`, y en tema
              oscuro el rojo aclara hasta dejar el blanco sin contraste. Con borde y texto en
              danger sobre el fondo de la card, los dos temas leen igual. */}
          <Button
            onClick={() => onConfirmar(motivo.trim() || undefined)}
            disabled={enviando}
            variant="secondary"
            className="border-danger-border text-danger hover:border-danger-border hover:bg-danger-bg active:bg-danger-bg"
          >
            {enviando ? 'Cancelando...' : 'Si, cancelar'}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}

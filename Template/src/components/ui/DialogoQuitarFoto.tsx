import { useId } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Dialogo } from './Dialogo';
import type { ItemGaleria } from '../../lib/galeria';

/**
 * Confirmacion para quitar una foto de resultado de la galeria.
 *
 * Se pregunta porque quitar **borra** — fila y archivo — y no se deshace desde la
 * interfaz: no es una despublicacion como la de productos. Re-subir la foto es lo unico
 * camino de vuelta, y el dialogo es barato comparado con perderla por un toque de mas.
 */
export function DialogoQuitarFoto({
  foto,
  abierto,
  onCerrar,
  onConfirmar,
  enviando,
  error,
}: {
  /** La foto marcada para quitar, o nulo si el dialogo esta cerrado. */
  foto: ItemGaleria | null;
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: () => void;
  enviando: boolean;
  error: string | null;
}) {
  const tituloId = useId();

  const cerrar = () => {
    if (!enviando) {
      onCerrar();
    }
  };

  return (
    <Dialogo open={abierto} onClose={cerrar} tituloId={tituloId} className="max-w-md">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id={tituloId} className="text-xl">
            Quitar esta foto?
          </h2>
          <p className="m-0 text-sm text-text">
            {foto?.titulo}. Se borra de la galeria y del servidor; para volver a mostrarla
            hay que subirla otra vez.
          </p>
        </div>

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={cerrar} disabled={enviando}>
            Volver
          </Button>
          {/* Contorno y no relleno, por lo mismo que en `DialogoCancelar`: no hay token de
              texto sobre `--color-danger` que sobreviva a los dos temas. */}
          <Button
            onClick={onConfirmar}
            disabled={enviando}
            variant="secondary"
            className="border-danger-border text-danger hover:border-danger-border hover:bg-danger-bg active:bg-danger-bg"
          >
            {enviando ? 'Quitando...' : 'Si, quitar'}
          </Button>
        </div>
      </div>
    </Dialogo>
  );
}

import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialogo } from './Dialogo';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  titulo: string;
  children: ReactNode;
};

// Modal de contenido: cabecera con titulo y X, cuerpo con scroll y pie con Cerrar. La
// mecanica del dialogo la pone `Dialogo`; aqui solo vive el cromo. Se cierra con la X, con
// el boton Cerrar, con Escape y con click en el backdrop.
//
// `variant="hoja"`: por debajo de `sm` sube pegada al borde, como el detalle de un
// servicio o de un especialista en un telefono — el mismo patron que la cuenta y el menu
// "Mas". De `sm` para arriba es el dialogo centrado de siempre.
export function Modal({ open, onClose, titulo, children }: ModalProps) {
  const tituloId = useId();

  return (
    <Dialogo
      open={open}
      onClose={onClose}
      tituloId={tituloId}
      variant="hoja"
      className="sm:max-w-md"
    >
      <div className="flex flex-none items-start justify-between gap-3 border-b border-border/70 px-5 py-3.5 sm:px-6 sm:py-4">
        <h2 id={tituloId} className="text-xl font-semibold tracking-tight text-text-h">
          {titulo}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="-mt-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text transition-colors hover:text-text-h focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6">{children}</div>

      <div className="flex flex-none justify-end border-t border-border/70 px-5 py-3.5 sm:px-6 sm:py-4">
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Dialogo>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  titulo: string;
  children: ReactNode;
};

// Usa el <dialog> nativo con showModal(): trae Escape, trampa de foco e inertizado del
// resto de la pagina sin codigo propio. Se cierra con la X, con el boton Cerrar, con
// Escape y con click en el backdrop.
export function Modal({ open, onClose, titulo, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={tituloId}
      onClose={onClose}
      onClick={(event) => {
        // showModal() centra el dialog y lo estira al viewport: un click cuyo target es el
        // propio <dialog> (y no su contenido) cae en el backdrop.
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-0 text-text backdrop:bg-black/60"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-6">
        <h2 id={tituloId} className="text-lg font-medium text-text-h">
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

      <div className="flex flex-col gap-4 p-4 sm:p-6">{children}</div>

      <div className="flex justify-end border-t border-border p-4 sm:p-6">
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </dialog>
  );
}

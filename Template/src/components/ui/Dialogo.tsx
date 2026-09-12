import { useEffect, useRef, type ReactNode } from 'react';

type DialogoProps = {
  open: boolean;
  onClose: () => void;
  /** Id del elemento que titula el dialogo, para `aria-labelledby`. */
  tituloId: string;
  /**
   * Ancho y forma los define quien lo usa. En `centro`, una clase sin prefijo:
   * `max-w-md`, `max-w-sm`. En `hoja`, con prefijo `sm:` — `sm:max-w-sm` — porque por
   * debajo de `sm` el ancho es siempre el del telefono y una clase sin prefijo ahi
   * competiria con esa regla por la misma propiedad.
   */
  className?: string;
  /**
   * `centro` (por defecto): dialogo centrado a cualquier ancho.
   * `hoja`: por debajo de `sm` sube pegada al borde inferior, a lo ancho del telefono —
   * como una cuenta o un menu, que en un pulgar se manejan mejor cerca del borde que en el
   * centro de la pantalla. De `sm` para arriba se comporta como `centro`.
   */
  variant?: 'centro' | 'hoja';
  children: ReactNode;
};

/**
 * La mecanica de un dialogo modal, sin decidir que va adentro.
 *
 * Usa el `<dialog>` nativo con `showModal()`: trae Escape, trampa de foco e inertizado del
 * resto de la pagina sin codigo propio. Vive separado de `Modal` porque el producto tiene su
 * propio modal compacto —otra cabecera, sin pie— y copiar esta parte para reusarla seria
 * copiar la accesibilidad, que es justo lo que no puede tener dos versiones.
 */
export function Dialogo({
  open,
  onClose,
  tituloId,
  className = '',
  variant = 'centro',
  children,
}: DialogoProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  // `hidden open:flex`: el <dialog> cerrado ya tiene display:none del navegador, y darle
  // flex directo lo dejaria visible siempre. Con la columna en flex, solo el cuerpo hace
  // scroll y la cabecera queda a la vista en cualquier posicion.
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
      className={`hidden max-h-[85dvh] flex-col overflow-hidden border border-border bg-surface/95 p-0 text-text shadow-2xl shadow-black/20 backdrop-blur-md open:flex backdrop:bg-black/60 backdrop:backdrop-blur-sm ${
        variant === 'hoja'
          ? `m-0 mt-auto w-full max-w-none animate-sheet-up rounded-t-2xl rounded-b-none border-b-0 sm:m-auto sm:w-[calc(100%-2rem)] sm:animate-modal-in sm:rounded-2xl sm:border-b ${className}`
          : `m-auto w-[calc(100%-2rem)] animate-modal-in rounded-2xl ${className}`
      }`}
    >
      {children}
    </dialog>
  );
}

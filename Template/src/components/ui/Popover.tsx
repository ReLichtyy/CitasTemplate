import { useEffect, useRef, type ReactNode } from 'react';

type PopoverProps = {
  open: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** Contenido visible del disparador. El `<button>`, el aria y el toggle los pone Popover. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Que abre el disparador, cuando su texto visible es el valor y no el proposito. */
  triggerAriaLabel?: string;
  /** Nombre del panel para el lector de pantalla ("Elegir fecha"). */
  label: string;
  panelClassName?: string;
  disabled?: boolean;
  children: ReactNode;
};

/**
 * Panel anclado a un disparador. No es un modal: no bloquea la pagina ni atrapa el foco,
 * porque elegir una fecha no es una decision que deba interrumpir el formulario.
 *
 * El disparador vive **dentro** del mismo contenedor que el panel a proposito: el cierre
 * por click afuera pregunta por ese contenedor, asi que un click en el disparador no
 * cierra-y-reabre. Escape cierra y devuelve el foco al disparador, que es de donde vino.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  triggerClassName = '',
  triggerAriaLabel,
  label,
  panelClassName = '',
  disabled = false,
  children,
}: PopoverProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const alApuntarAfuera = (evento: PointerEvent) => {
      if (!contenedorRef.current?.contains(evento.target as Node)) {
        onOpenChange(false);
      }
    };
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        onOpenChange(false);
        disparadorRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', alApuntarAfuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alApuntarAfuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [open, onOpenChange]);

  // Al abrir, el foco entra al panel: sin esto el Tab siguiente sigue en el formulario y
  // el contenido recien abierto queda inalcanzable por teclado hasta recorrerlo entero.
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  return (
    <div ref={contenedorRef} className="relative">
      <button
        ref={disparadorRef}
        type="button"
        disabled={disabled}
        aria-label={triggerAriaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={`absolute top-full left-0 z-30 mt-2 w-max animate-modal-in rounded-xl border border-border bg-surface p-2.5 shadow-xl shadow-black/10 outline-hidden ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

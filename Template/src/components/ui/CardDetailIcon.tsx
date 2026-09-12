// Afordancia de "abrir detalle" de una card. Queda tenue en reposo —en un telefono no hay
// hover, asi que ocultarlo del todo dejaria la card sin pista de que es tocable— y toma el
// acento cuando la card recibe hover o foco (`group` en CARD_INTERACTIVE_CLASSES).
export function CardDetailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-text-muted opacity-60 transition-colors group-hover:text-accent-ink group-hover:opacity-100 group-focus-visible:text-accent-ink group-focus-visible:opacity-100"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

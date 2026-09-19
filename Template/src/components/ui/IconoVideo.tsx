// Glyph de video para el contenedor de la landing: marca el recuadro como reproductor,
// tambien en reposo — cuando el negocio todavia no cargo su video es lo unico que dice
// para que es ese espacio. currentColor y aria-hidden, como todos los iconos de aca.
export function IconoVideo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m22 8-6 4 6 4V8Z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

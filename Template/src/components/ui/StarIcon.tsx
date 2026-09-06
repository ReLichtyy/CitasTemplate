// Estrella de cuatro puntas (destello), no la de cinco puntas de siempre: distingue el
// rating del resto de la interfaz sin meter otro color en la paleta.
export function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 1.5 14.4 9.6 22.5 12 14.4 14.4 12 22.5 9.6 14.4 1.5 12 9.6 9.6Z" />
    </svg>
  );
}

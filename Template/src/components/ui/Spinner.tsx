export function Spinner({ label = 'Cargando...' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-text">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

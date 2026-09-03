export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border py-12 text-center">
      <p className="font-medium text-text-h">{title}</p>
      {description && <p className="text-sm text-text">{description}</p>}
    </div>
  );
}

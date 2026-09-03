import type { ReactNode } from 'react';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-3xl">{title}</h1>
      {actions}
    </div>
  );
}

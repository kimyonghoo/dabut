import type { ReactNode } from "react";

export function PageHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 pb-4 pt-2">
      <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
      {action}
    </header>
  );
}

import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={`rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[0_2px_12px_rgba(59,47,42,0.05)] ${className}`}
    />
  );
}

/** Two snuggling hearts that bob in turn — 다붓's loading mark. */
export function HeartLoader({ label }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="relative flex h-12 w-16 items-center justify-center">
        <span className="absolute left-2 text-3xl text-partner animate-bounce [animation-delay:-0.15s]">♥</span>
        <span className="absolute right-2 text-3xl text-brand animate-bounce">♥</span>
      </div>
      <span className="text-sm text-ink-muted">{label ?? "불러오는 중…"}</span>
    </div>
  );
}

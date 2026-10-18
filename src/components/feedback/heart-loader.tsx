import { Heart } from "lucide-react";

/** Two snuggling hearts that bob in turn — 다붓's loading mark. */
export function HeartLoader({ label }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="relative flex h-12 w-16 items-center justify-center">
        <Heart aria-hidden className="absolute left-2 size-8 fill-current text-partner animate-bounce [animation-delay:-0.15s]" strokeWidth={1.75} />
        <Heart aria-hidden className="absolute right-2 size-8 fill-current text-brand animate-bounce" strokeWidth={1.75} />
      </div>
      <span className="text-sm text-ink-muted">{label ?? "불러오는 중…"}</span>
    </div>
  );
}

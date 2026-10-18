"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Shows a one-shot toast for `?toast=<key>` (key from the `toast` message
 * namespace), then strips the param from the URL without a refetch.
 * Server Actions redirect to e.g. /calendar?toast=eventCreated.
 */
function ToasterInner() {
  const t = useTranslations("toast");
  const searchParams = useSearchParams();
  const key = searchParams.get("toast");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    setMessage(t.has(key) ? t(key) : key);
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    const timer = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [key, t]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-[90] flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-surface/95 px-4 py-2.5 text-sm font-semibold text-ink shadow-lg backdrop-blur animate-[toast-in_220ms_ease-out]"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] text-white">✓</span>
        {message}
      </div>
    </div>
  );
}

export function Toaster() {
  return (
    <Suspense fallback={null}>
      <ToasterInner />
    </Suspense>
  );
}

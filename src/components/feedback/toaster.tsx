"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Check } from "lucide-react";
import { TOAST_EVENT, type ToastDetail, type ToastTone } from "./toast-bus";

type ToastState = { message: string; tone: ToastTone; id: number };

/**
 * Shows a one-shot toast for `?toast=<key>` (key from the `toast` message
 * namespace), then strips the param from the URL without a refetch.
 * Server Actions redirect to e.g. /calendar?toast=eventCreated.
 * Client code can also call `showToast(key, tone)` from ./toast-bus.
 */
function ToasterInner() {
  const t = useTranslations("toast");
  const searchParams = useSearchParams();
  const key = searchParams.get("toast");
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!key) return;
    setToast({ message: t.has(key) ? t(key) : key, tone: "success", id: Date.now() });
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [key, t]);

  useEffect(() => {
    function onToast(event: Event) {
      const { key: toastKey, tone } = (event as CustomEvent<ToastDetail>).detail;
      setToast({ message: t.has(toastKey) ? t(toastKey) : toastKey, tone, id: Date.now() });
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, [t]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  const isError = toast.tone === "error";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-[90] flex justify-center px-4">
      <div
        key={toast.id}
        role={isError ? "alert" : "status"}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-surface/95 px-4 py-2.5 text-sm font-semibold text-ink shadow-lg backdrop-blur animate-[toast-in_220ms_ease-out]"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${
            isError ? "bg-expense" : "bg-brand"
          }`}
        >
          {isError ? (
            <AlertCircle aria-hidden className="size-3.5" strokeWidth={2.5} />
          ) : (
            <Check aria-hidden className="size-3" strokeWidth={3} />
          )}
        </span>
        {toast.message}
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

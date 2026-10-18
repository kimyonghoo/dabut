"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckCircle2, CreditCard, X } from "lucide-react";
import { formatWon } from "@/components/ledger/category-icon";

export type PaymentMethodGoalItem = {
  id: string;
  name: string;
  icon: string | null;
  monthlyGoal: number;
  spent: number;
};

/**
 * Bottom sheet listing every payment method with a monthly goal set, each
 * with a progress bar toward this calendar month's spend. Mirrors
 * day-summary-sheet.tsx's bottom-sheet mechanics exactly (backdrop,
 * drag-to-dismiss handle, Escape/outside-click close, scroll lock) — this
 * feature has only one trigger (the ledger hero's "카드실적" button), so it's
 * a plain controlled component rather than day-summary's provider pattern.
 */
export function PaymentMethodGoalsSheet({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: PaymentMethodGoalItem[];
}) {
  const t = useTranslations("cardGoals");
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > 100 || info.velocity.y > 600) onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-goals-title"
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
            drag={reduceMotion ? false : "y"}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="relative flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-[var(--radius-card)] border border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-8px_30px_rgba(59,47,42,0.18)] outline-none sm:rounded-[var(--radius-card)] sm:pb-4"
          >
            <div
              className="shrink-0 touch-none"
              onPointerDown={(e) => {
                if (!reduceMotion) dragControls.start(e);
              }}
            >
              <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
              <header className="flex items-center justify-between gap-2 px-5 pb-2 pt-3">
                <h2 id="card-goals-title" className="text-lg font-bold text-ink">
                  {t("title")}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("close")}
                  className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </header>
            </div>
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pb-4">
              {items.length === 0 ? (
                <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">{t("empty")}</p>
              ) : (
                items.map((item) => {
                  const pct = item.monthlyGoal > 0 ? (item.spent / item.monthlyGoal) * 100 : 0;
                  const done = pct >= 100;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-3.5 ${
                        done ? "border-income/30 bg-income/10" : "border-line bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {item.icon ? (
                          <span aria-hidden className="text-lg leading-none">
                            {item.icon}
                          </span>
                        ) : (
                          <CreditCard aria-hidden className="size-5 text-ink-muted" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{item.name}</span>
                        {done ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-income/15 px-2 py-0.5 text-xs font-bold text-income">
                            <CheckCircle2 aria-hidden className="size-3.5" />
                            {t("achieved")}
                          </span>
                        ) : (
                          <span className="shrink-0 text-sm font-bold text-brand-strong">{Math.floor(pct)}%</span>
                        )}
                      </div>
                      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          className={`h-full rounded-full transition-[width] ${
                            done ? "bg-income" : "bg-gradient-to-r from-brand to-[#ff9a6c]"
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-ink-muted">
                        {formatWon(item.spent)} / {formatWon(item.monthlyGoal)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

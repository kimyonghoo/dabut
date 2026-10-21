"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import { monthHref } from "./date-locale";

const YEAR_SPAN_BEFORE = 6;
const YEAR_SPAN_AFTER = 4;

/** Short, locale-agnostic month labels — "1월".."12월" / "Jan".."Dec" / "1月".."12月". */
function monthLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" });
  return Array.from({ length: 12 }, (_, i) => formatter.format(new Date(2000, i, 1)));
}

/**
 * Touching the month/year title opens this: a two-depth picker (year grid,
 * then drilling into that year's month grid) for jumping straight to a
 * distant month instead of tapping the prev/next arrows dozens of times.
 * Shares the exact same `/calendar?month=yyyy-MM` / `/ledger?month=yyyy-MM`
 * href shape as the arrows (see date-locale.ts's monthHref) so all three
 * navigation paths — arrows, swipe, and this picker — can never drift apart.
 */
export function MonthYearPicker({
  month,
  monthTitle,
  basePath = "/calendar",
  extraQuery,
  locale,
}: {
  month: Date;
  monthTitle: string;
  basePath?: "/calendar" | "/ledger";
  extraQuery?: Record<string, string>;
  locale: string;
}) {
  const t = useTranslations("monthPicker");
  const router = useProgressRouter();
  const [, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [depth, setDepth] = useState<"years" | "months">("years");
  const [pickYear, setPickYear] = useState(month.getFullYear());
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const labels = useMemo(() => monthLabels(locale), [locale]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDepth("years");
    setPickYear(month.getFullYear());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: YEAR_SPAN_BEFORE + YEAR_SPAN_AFTER + 1 },
    (_, i) => currentYear - YEAR_SPAN_BEFORE + i
  );

  function go(target: Date) {
    const href = monthHref(target, basePath, extraQuery);
    startTransition(() => router.push(href));
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("jumpAria")}
        className="rounded-md px-1 -mx-1 transition hover:bg-surface-2 active:scale-95"
      >
        {monthTitle}
      </button>
      {mounted &&
        createPortal(
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
                  onClick={() => setOpen(false)}
                />
                <motion.div
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  tabIndex={-1}
                  initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
                  animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
                  transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
                  className="relative flex w-full max-w-md flex-col rounded-t-[var(--radius-card)] border border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-8px_30px_rgba(59,47,42,0.18)] outline-none sm:rounded-[var(--radius-card)] sm:pb-4"
                >
                  <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
                  <header className="flex items-center justify-between gap-2 px-5 pb-2 pt-3">
                    {depth === "months" ? (
                      <button
                        type="button"
                        onClick={() => setDepth("years")}
                        className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1.5 text-lg font-bold text-ink transition hover:bg-surface-2"
                      >
                        <ChevronLeft aria-hidden className="size-5 text-ink-muted" />
                        {pickYear}
                      </button>
                    ) : (
                      <h2 className="text-lg font-bold text-ink">{t("selectYear")}</h2>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label={t("close")}
                      className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2"
                    >
                      <X aria-hidden className="size-5" />
                    </button>
                  </header>
                  <div className="overflow-hidden px-4 pb-3">
                    <AnimatePresence mode="wait" initial={false}>
                      {depth === "years" ? (
                        <motion.div
                          key="years"
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                          transition={{ duration: 0.16 }}
                          className="grid grid-cols-3 gap-2"
                        >
                          {years.map((year) => (
                            <button
                              key={year}
                              type="button"
                              onClick={() => {
                                setPickYear(year);
                                setDepth("months");
                              }}
                              className={`rounded-xl px-2 py-2.5 text-sm font-semibold transition active:scale-95 ${
                                year === month.getFullYear()
                                  ? "bg-brand text-white"
                                  : "bg-surface-2 text-ink hover:bg-surface-2/70"
                              }`}
                            >
                              {year}
                            </button>
                          ))}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="months"
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
                          transition={{ duration: 0.16 }}
                          className="flex flex-col gap-2"
                        >
                          <div className="mb-1 flex items-center justify-center gap-4">
                            <button
                              type="button"
                              aria-label="-1 year"
                              onClick={() => setPickYear((y) => y - 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2 active:scale-90"
                            >
                              <ChevronLeft aria-hidden className="size-5" />
                            </button>
                            <span className="min-w-12 text-center text-sm font-semibold text-ink-muted">
                              {pickYear}
                            </span>
                            <button
                              type="button"
                              aria-label="+1 year"
                              onClick={() => setPickYear((y) => y + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2 active:scale-90"
                            >
                              <ChevronRight aria-hidden className="size-5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {labels.map((label, i) => {
                              const isCurrentSelection = pickYear === month.getFullYear() && i === month.getMonth();
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => go(new Date(pickYear, i, 1))}
                                  className={`rounded-xl px-2 py-2.5 text-sm font-semibold transition active:scale-95 ${
                                    isCurrentSelection
                                      ? "bg-brand text-white"
                                      : "bg-surface-2 text-ink hover:bg-surface-2/70"
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

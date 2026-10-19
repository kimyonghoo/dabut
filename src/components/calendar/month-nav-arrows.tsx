"use client";

import { useTransition } from "react";
import { addMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import { monthHref } from "./date-locale";

const navClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-full text-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink active:scale-90";

/**
 * Prev/next month arrows for the calendar header. Navigation is wrapped in
 * `startTransition` (same pattern as use-locale-switcher.ts) so React keeps
 * the current month's content mounted and visible while the new month's
 * RSC payload streams in, instead of the route's loading.tsx fallback
 * replacing it instantly — that instant swap-to-blank, not a slow fetch by
 * itself, was the actual cause of the multi-second blank gap on month
 * navigation. See MonthSlide for the resulting slide animation.
 */
export function MonthNavArrows({
  month,
  monthTitle,
  prevLabel,
  nextLabel,
}: {
  month: Date;
  monthTitle: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const router = useProgressRouter();
  const [, startTransition] = useTransition();

  function go(nextMonth: Date) {
    const href = monthHref(nextMonth);
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" aria-label={prevLabel} className={navClass} onClick={() => go(addMonths(month, -1))}>
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <span>{monthTitle}</span>
      <button type="button" aria-label={nextLabel} className={navClass} onClick={() => go(addMonths(month, 1))}>
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </span>
  );
}

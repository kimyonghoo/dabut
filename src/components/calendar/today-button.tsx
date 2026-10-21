"use client";

import { isSameMonth } from "date-fns";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import { monthHref } from "./date-locale";

/**
 * Jumps the calendar/ledger straight to the current month — only rendered
 * while viewing a different month, since on the current month it would be a
 * no-op button taking up space next to "+ 일정 추가" for nothing.
 */
export function TodayButton({
  month,
  basePath = "/calendar",
  extraQuery,
}: {
  month: Date;
  basePath?: "/calendar" | "/ledger";
  extraQuery?: Record<string, string>;
}) {
  const t = useTranslations("dates");
  const router = useProgressRouter();
  const [, startTransition] = useTransition();

  if (isSameMonth(month, new Date())) return null;

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.push(monthHref(new Date(), basePath, extraQuery)))}
      className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand-soft active:scale-95"
    >
      {t("today")}
    </button>
  );
}

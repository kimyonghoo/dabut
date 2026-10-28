"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlignJustify, CalendarDays } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { useProgressRouter } from "@/components/feedback/use-progress-router";

export function ViewToggle() {
  const t = useTranslations("calendar");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useProgressRouter();
  const view = searchParams.get("view") ?? "month";
  const month = searchParams.get("month");

  const go = (next: "month" | "thread") =>
    router.push({ pathname, query: month ? { view: next, month } : { view: next } });

  const itemClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition active:scale-[0.97] ${
      active ? "bg-surface text-brand shadow-sm" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <nav className="flex shrink-0 rounded-full border border-line bg-surface-2 p-0.5">
      <button
        type="button"
        aria-pressed={view === "month"}
        className={itemClass(view === "month")}
        onClick={() => go("month")}
      >
        <CalendarDays aria-hidden className="size-4" />
        <span className="sr-only">{t("monthView")}</span>
      </button>
      <button
        type="button"
        aria-pressed={view === "thread"}
        className={itemClass(view === "thread")}
        onClick={() => go("thread")}
      >
        <AlignJustify aria-hidden className="size-4" />
        <span className="sr-only">{t("threadView")}</span>
      </button>
    </nav>
  );
}

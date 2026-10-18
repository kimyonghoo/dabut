"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function ViewToggle() {
  const t = useTranslations("calendar");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const view = searchParams.get("view") ?? "month";
  const month = searchParams.get("month");

  const go = (next: "month" | "thread") =>
    router.push({ pathname, query: month ? { view: next, month } : { view: next } });

  const itemClass = (active: boolean) =>
    `flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-[0.97] ${
      active ? "bg-surface text-brand shadow-sm" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <nav className="flex w-full max-w-60 rounded-full border border-line bg-surface-2 p-1">
      <button
        type="button"
        aria-pressed={view === "month"}
        className={itemClass(view === "month")}
        onClick={() => go("month")}
      >
        📅 {t("monthView")}
      </button>
      <button
        type="button"
        aria-pressed={view === "thread"}
        className={itemClass(view === "thread")}
        onClick={() => go("thread")}
      >
        🧵 {t("threadView")}
      </button>
    </nav>
  );
}

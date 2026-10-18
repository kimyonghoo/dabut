"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? t("light") : t("dark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative inline-flex h-10 w-[148px] shrink-0 items-center rounded-full border border-line bg-surface-2 p-1 text-sm font-semibold transition"
    >
      <span
        aria-hidden
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-surface shadow-sm transition-all duration-300 ${
          isDark ? "left-[calc(50%+0px)]" : "left-1"
        }`}
      />
      <span
        aria-hidden
        className={`relative z-10 flex flex-1 items-center justify-center gap-1 transition ${
          isDark ? "text-ink-muted" : "text-ink"
        }`}
      >
        <Sun aria-hidden className="size-4" strokeWidth={2} /> <span>{t("light")}</span>
      </span>
      <span
        aria-hidden
        className={`relative z-10 flex flex-1 items-center justify-center gap-1 transition ${
          isDark ? "text-ink" : "text-ink-muted"
        }`}
      >
        <Moon aria-hidden className="size-4" strokeWidth={2} /> <span>{t("dark")}</span>
      </span>
    </button>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? t("light") : t("dark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative inline-flex shrink-0 items-center rounded-full border border-line bg-surface-2 font-semibold transition ${
        compact ? "h-8 w-[116px] p-0.5 text-xs" : "h-10 w-[148px] p-1 text-sm"
      }`}
    >
      <span
        aria-hidden
        className={`absolute rounded-full bg-surface shadow-sm transition-all duration-300 ${
          compact ? "top-0.5 bottom-0.5 w-[calc(50%-2px)]" : "top-1 bottom-1 w-[calc(50%-4px)]"
        } ${isDark ? "left-[calc(50%+0px)]" : "left-1"}`}
      />
      <span
        aria-hidden
        className={`relative z-10 flex flex-1 items-center justify-center gap-1 transition ${
          isDark ? "text-ink-muted" : "text-ink"
        }`}
      >
        <Sun aria-hidden className={compact ? "size-3.5" : "size-4"} strokeWidth={2} /> <span>{t("light")}</span>
      </span>
      <span
        aria-hidden
        className={`relative z-10 flex flex-1 items-center justify-center gap-1 transition ${
          isDark ? "text-ink" : "text-ink-muted"
        }`}
      >
        <Moon aria-hidden className={compact ? "size-3.5" : "size-4"} strokeWidth={2} /> <span>{t("dark")}</span>
      </span>
    </button>
  );
}

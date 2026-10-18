"use client";

import { useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { LOCALE_LABELS, useLocaleSwitcher } from "@/components/settings/use-locale-switcher";

export function LanguageSelect({ userId }: { userId: string | null }) {
  const t = useTranslations("settings");
  const { locale, choose, pending } = useLocaleSwitcher(userId);

  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      className="flex w-full rounded-full border border-line bg-surface-2 p-1"
    >
      {routing.locales.map((value) => {
        const active = value === locale;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            lang={value}
            disabled={pending}
            onClick={() => choose(value)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60 ${
              active ? "bg-surface text-brand shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {LOCALE_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}

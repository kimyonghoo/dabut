"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import { createClient } from "@/lib/supabase/client";

type AppLocale = (typeof routing.locales)[number];

// Shown in their own language so anyone can find theirs.
const LABELS: Record<AppLocale, string> = { ko: "한국어", en: "English", zh: "中文" };

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The active locale comes from the URL prefix (/ko, /en, /zh). Unprefixed
 * visits (e.g. "/") are resolved by next-intl's middleware from the
 * NEXT_LOCALE cookie, so switching sets that cookie and moves to the same
 * page under the new prefix; profiles.locale is updated too (best effort).
 */
export function LanguageSelect({ userId }: { userId: string | null }) {
  const t = useTranslations("settings");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useProgressRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: AppLocale) {
    if (next === locale || pending) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    if (userId) {
      void createClient().from("profiles").update({ locale: next }).eq("id", userId);
    }
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

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
            {LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}

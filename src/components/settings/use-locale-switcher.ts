"use client";

import { useEffect, useRef, useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import { createClient } from "@/lib/supabase/client";

export type AppLocale = (typeof routing.locales)[number];

// Shown in their own language so anyone can find theirs.
export const LOCALE_LABELS: Record<AppLocale, string> = { ko: "한국어", en: "English", zh: "中文" };

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The active locale comes from the URL prefix (/ko, /en, /zh). Unprefixed
 * visits (e.g. "/") are resolved by next-intl's middleware from the
 * NEXT_LOCALE cookie, so switching sets that cookie and moves to the same
 * page under the new prefix; profiles.locale is updated too (best effort).
 *
 * Shared by LanguageSelect and SettingsQuickControls so both pick/switch
 * the locale the same way.
 */
export function useLocaleSwitcher(userId: string | null) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useProgressRouter();
  const [pending, startTransition] = useTransition();
  // Resolves the in-flight View Transition once the transition above has
  // actually committed the new locale's content (not just been kicked off),
  // so the browser's cross-fade covers the real content swap.
  const resolveViewTransition = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!pending && resolveViewTransition.current) {
      resolveViewTransition.current();
      resolveViewTransition.current = null;
    }
  }, [pending]);

  function choose(next: AppLocale) {
    if (next === locale || pending) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    if (userId) {
      void createClient().from("profiles").update({ locale: next }).eq("id", userId);
    }

    const navigate = () => {
      startTransition(() => {
        // scroll: false — same page, different locale prefix; no reason to
        // jump the viewport back to top mid-switch.
        router.replace(pathname, { locale: next, scroll: false });
      });
    };

    // Cross-fade the content swap instead of an abrupt replace, where
    // supported (Chrome/Edge/Safari 18+). No-ops gracefully elsewhere.
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            resolveViewTransition.current = resolve;
            navigate();
          })
      );
    } else {
      navigate();
    }
  }

  return { locale, choose, pending };
}

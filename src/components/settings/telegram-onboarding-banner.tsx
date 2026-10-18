"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PaperPlane } from "./telegram-link";

const STORAGE_KEY = "dabut.tgBannerDismissed";

/** Nudges users without a linked Telegram to connect it in settings. */
export function TelegramOnboardingBanner() {
  const t = useTranslations("telegram");
  // Start hidden so a previously dismissed banner never flashes in.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // storage unavailable: just show the banner
    }
    setVisible(!dismissed);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  if (!visible) return null;

  return (
    <aside className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[#2AABEE]/30 bg-[#2AABEE]/10 p-3">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#2AABEE]/15 text-[#2AABEE]"
      >
        <PaperPlane className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-ink">
          {t.has("bannerText") ? t("bannerText") : "텔레그램을 연결하면 상대방 소식을 바로 받아요"}
        </p>
        <Link href="/settings" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-[#2AABEE] hover:underline">
          {t.has("bannerCta") ? t("bannerCta") : "연결하러 가기"} <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.has("bannerDismiss") ? t("bannerDismiss") : "닫기"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-surface-2 hover:text-ink"
      >
        <X aria-hidden className="size-4" strokeWidth={2} />
      </button>
    </aside>
  );
}

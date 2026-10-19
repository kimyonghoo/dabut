"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Moon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * "내일 뭐해?" — opt-in Telegram push summarizing tomorrow's events, sent
 * once a day at a fixed 6 PM (see the daily-digest cron route) — no
 * per-user hour picker, just on/off. Writes straight to `profiles` on
 * toggle, same pattern as the other Settings quick controls (brand color,
 * timezone) — no separate save step.
 */
export function DailyDigestSettings({
  userId,
  initialEnabled,
}: {
  userId: string | null;
  initialEnabled: boolean;
}) {
  const t = useTranslations("settings.dailyDigest");
  const [enabled, setEnabled] = useState(initialEnabled);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    if (!userId) return;
    void createClient().from("profiles").update({ daily_digest_enabled: next }).eq("id", userId);
  }

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
        <Moon className="size-4.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{t("title")}</p>
        <p className="text-xs text-ink-muted">{t("description")}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t("title")}
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          enabled ? "bg-brand" : "bg-surface-2"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${
            enabled ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

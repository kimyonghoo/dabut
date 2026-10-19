"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/components/feedback/toast-bus";
import { buttonClass } from "@/components/ui/button";

/**
 * "내일 뭐해?" — opt-in Telegram push summarizing tomorrow's events, sent
 * once a day at a fixed 6 PM (see the daily-digest cron route) — no
 * per-user hour picker, just on/off. Mirrors TelegramLink's layout exactly
 * (bare icon + title on the left, a single connect/disconnect-style button
 * on the right) rather than a toggle switch, so the two Settings rows read
 * the same way. Writes straight to `profiles` on click, same pattern as the
 * other Settings quick controls — no separate save step.
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
    if (next) showToast("dailyDigestEnabled");
    if (!userId) return;
    void createClient().from("profiles").update({ daily_digest_enabled: next }).eq("id", userId);
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
        <CalendarCheck2 aria-hidden className="size-4 shrink-0 text-brand" />
        <span className="truncate">{t("title")}</span>
      </h2>
      <button
        type="button"
        onClick={toggle}
        className={buttonClass(enabled ? "danger" : "primary", "shrink-0 !px-3.5 !py-2")}
      >
        {enabled ? t("turnOff") : t("turnOn")}
      </button>
    </div>
  );
}

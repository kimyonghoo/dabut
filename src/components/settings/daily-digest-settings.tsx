"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck2 } from "lucide-react";
import { toggleDailyDigest } from "@/lib/actions/daily-digest";
import { showToast } from "@/components/feedback/toast-bus";
import { buttonClass } from "@/components/ui/button";

/**
 * "내일 뭐해?" — opt-in Telegram push summarizing tomorrow's events, sent
 * once a day at a fixed 6 PM (see the daily-digest cron route) — no
 * per-user hour picker, just on/off. Mirrors TelegramLink's layout exactly
 * (bare icon + title on the left, a single connect/disconnect-style button
 * on the right) rather than a toggle switch, so the two Settings rows read
 * the same way.
 */
export function DailyDigestSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const t = useTranslations("settings.dailyDigest");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await toggleDailyDigest(next);
      if (!result.ok) {
        // Roll back the optimistic flip — the DB write didn't actually land.
        setEnabled(!next);
        showToast("dailyDigestToggleFailed", "error");
        return;
      }
      if (next) showToast("dailyDigestEnabled");
    });
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
        disabled={pending}
        className={buttonClass(enabled ? "danger" : "primary", "shrink-0 !px-3.5 !py-2")}
      >
        {enabled ? t("turnOff") : t("turnOn")}
      </button>
    </div>
  );
}

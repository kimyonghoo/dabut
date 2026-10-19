"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Moon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { inputClass, labelClass } from "@/components/ui/field";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * "내일 뭐해?" — opt-in Telegram push summarizing tomorrow's events, sent
 * once a day at a user-chosen local hour (see the daily-digest cron route).
 * Writes straight to `profiles` on every change, same pattern as the other
 * Settings quick toggles (brand color, timezone) — no separate save step.
 */
export function DailyDigestSettings({
  userId,
  initialEnabled,
  initialHour,
}: {
  userId: string | null;
  initialEnabled: boolean;
  initialHour: number | null;
}) {
  const t = useTranslations("settings.dailyDigest");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [hour, setHour] = useState(initialHour ?? 20);

  async function persist(next: { enabled: boolean; hour: number }) {
    if (!userId) return;
    await createClient()
      .from("profiles")
      .update({ daily_digest_enabled: next.enabled, daily_digest_hour: next.hour })
      .eq("id", userId);
  }

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    void persist({ enabled: next, hour });
  }

  function changeHour(value: number) {
    setHour(value);
    void persist({ enabled, hour: value });
  }

  return (
    <div className="flex flex-col gap-3">
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

      {enabled && (
        <label className={labelClass}>
          {t("hourLabel")}
          <select
            value={hour}
            onChange={(e) => changeHour(Number(e.target.value))}
            className={inputClass}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Clock, Languages, Moon, Sun } from "lucide-react";
import { routing } from "@/i18n/routing";
import { BRAND_PRESETS } from "@/components/settings/brand-color-picker";
import { LOCALE_LABELS, useLocaleSwitcher } from "@/components/settings/use-locale-switcher";
import { TIMEZONE_CHOICES } from "@/lib/dates/timezone";

type Panel = "language" | "palette" | "timezone" | null;

const ICON_BUTTON =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink transition hover:bg-brand-soft active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const PANEL =
  "absolute right-0 top-full z-20 mt-2 rounded-2xl border border-line bg-surface p-2 shadow-lg";

/**
 * Unified 4-icon cluster for the Settings PageHeader: language, brand color,
 * timezone, and light/dark theme — all the same circular treatment, left to
 * right. Only one popover (language, palette, or timezone) is open at a
 * time; the theme button has no popover, it flips the theme directly on tap.
 */
export function SettingsQuickControls({
  userId,
  brandColor,
  onBrandColorChange,
  timeZone,
  onTimezoneChange,
}: {
  userId: string | null;
  brandColor: string;
  onBrandColorChange: (value: string) => void;
  timeZone: string;
  onTimezoneChange: (value: string) => void;
}) {
  const t = useTranslations("settings");
  const tTheme = useTranslations("theme");
  const { resolvedTheme, setTheme } = useTheme();
  const { locale, choose, pending } = useLocaleSwitcher(userId);
  const [panel, setPanel] = useState<Panel>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!panel) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setPanel(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panel]);

  function toggle(next: Exclude<Panel, null>) {
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <div ref={rootRef} className="flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          aria-label={t("language")}
          aria-haspopup="menu"
          aria-expanded={panel === "language"}
          onClick={() => toggle("language")}
          className={ICON_BUTTON}
        >
          <Languages aria-hidden className="size-4" strokeWidth={2} />
        </button>
        {panel === "language" && (
          <div role="menu" aria-label={t("language")} className={`${PANEL} flex w-36 flex-col gap-0.5`}>
            {routing.locales.map((value) => {
              const active = value === locale;
              return (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  lang={value}
                  disabled={pending}
                  onClick={() => {
                    choose(value);
                    setPanel(null);
                  }}
                  className={`rounded-xl px-3 py-2 text-left text-sm font-semibold transition disabled:opacity-60 ${
                    active ? "bg-brand-soft text-brand-strong" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {LOCALE_LABELS[value]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label={t("brandColor")}
          aria-haspopup="menu"
          aria-expanded={panel === "palette"}
          onClick={() => toggle("palette")}
          className={ICON_BUTTON}
        >
          <span
            aria-hidden
            className="size-4 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: brandColor }}
          />
        </button>
        {panel === "palette" && (
          <div role="menu" aria-label={t("brandColor")} className={`${PANEL} flex w-[164px] flex-wrap gap-2`}>
            {BRAND_PRESETS.map((preset, index) => {
              const selected = preset.value.toLowerCase() === brandColor.toLowerCase();
              return (
                <button
                  key={preset.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  aria-label={preset.name}
                  title={preset.name}
                  onClick={() => {
                    onBrandColorChange(preset.value);
                    setPanel(null);
                  }}
                  style={{ backgroundColor: preset.value, animationDelay: `${index * 35}ms` }}
                  className={`size-7 shrink-0 animate-[swatch-in_260ms_ease-out_backwards] rounded-full shadow-sm transition active:scale-95 ${
                    selected ? "ring-2 ring-ink ring-offset-2 ring-offset-surface scale-110" : "hover:scale-105"
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label={t("timezone")}
          aria-haspopup="menu"
          aria-expanded={panel === "timezone"}
          onClick={() => toggle("timezone")}
          className={ICON_BUTTON}
        >
          <Clock aria-hidden className="size-4" strokeWidth={2} />
        </button>
        {panel === "timezone" && (
          <div role="menu" aria-label={t("timezone")} className={`${PANEL} flex w-48 flex-col gap-0.5`}>
            {TIMEZONE_CHOICES.map((choice) => {
              const active = choice.value === timeZone;
              return (
                <button
                  key={choice.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onTimezoneChange(choice.value);
                    setPanel(null);
                  }}
                  className={`rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                    active ? "bg-brand-soft text-brand-strong" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label={isDark ? tTheme("light") : tTheme("dark")}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={ICON_BUTTON}
      >
        {isDark ? (
          <Moon aria-hidden className="size-4" strokeWidth={2} />
        ) : (
          <Sun aria-hidden className="size-4" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

export const BRAND_PRESETS = [
  { value: "#FF6F61", name: "Coral" },
  { value: "#FF8FAB", name: "Pink" },
  { value: "#F5A524", name: "Honey" },
  { value: "#7BC67E", name: "Mint" },
  { value: "#5BB8D6", name: "Sky" },
  { value: "#8E7CF0", name: "Lavender" },
  { value: "#E2725B", name: "Terracotta" },
  { value: "#6B4F4F", name: "Cocoa" },
] as const;

const RING = "ring-2 ring-offset-2 ring-offset-surface ring-ink scale-110";

export function BrandColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("settings");
  const current = value.toLowerCase();
  const isPreset = BRAND_PRESETS.some((p) => p.value.toLowerCase() === current);

  return (
    <div role="radiogroup" aria-label={t("brandColor")} className="flex flex-wrap items-center gap-3">
      {BRAND_PRESETS.map((preset) => {
        const selected = preset.value.toLowerCase() === current;
        return (
          <button
            key={preset.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={preset.name}
            title={preset.name}
            onClick={() => onChange(preset.value)}
            className={`grid h-9 w-9 place-items-center rounded-full shadow-sm transition active:scale-95 ${
              selected ? RING : "hover:scale-105"
            }`}
            style={{ backgroundColor: preset.value }}
          >
            {selected && (
              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={3}>
                <path d="M5 10.5l3.2 3L15 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        );
      })}
      <label
        title={t("customColor")}
        className={`relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full shadow-sm transition ${
          !isPreset ? RING : "hover:scale-105"
        }`}
        style={{
          background: isPreset
            ? "conic-gradient(#FF6F61, #F5A524, #7BC67E, #5BB8D6, #8E7CF0, #FF8FAB, #FF6F61)"
            : value,
        }}
      >
        <span className="sr-only">{t("customColor")}</span>
        <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-surface/90 text-xs font-bold text-ink">
          +
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

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
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const t = useTranslations("settings");
  const current = value.toLowerCase();
  const isPreset = BRAND_PRESETS.some((p) => p.value.toLowerCase() === current);
  const swatchSize = compact ? "h-6 w-6" : "h-9 w-9";
  const gap = compact ? "gap-1.5" : "gap-3";

  return (
    <div role="radiogroup" aria-label={t("brandColor")} className={`flex flex-wrap items-center ${gap}`}>
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
            className={`grid place-items-center rounded-full shadow-sm transition active:scale-95 ${swatchSize} ${
              selected ? RING : "hover:scale-105"
            }`}
            style={{ backgroundColor: preset.value }}
          >
            {selected && (
              <Check aria-hidden className={compact ? "size-3 text-white" : "size-4 text-white"} strokeWidth={3} />
            )}
          </button>
        );
      })}
      <label
        title={t("customColor")}
        className={`relative grid cursor-pointer place-items-center overflow-hidden rounded-full shadow-sm transition ${swatchSize} ${
          !isPreset ? RING : "hover:scale-105"
        }`}
        style={{
          background: isPreset
            ? "conic-gradient(#FF6F61, #F5A524, #7BC67E, #5BB8D6, #8E7CF0, #FF8FAB, #FF6F61)"
            : value,
        }}
      >
        <span className="sr-only">{t("customColor")}</span>
        <span
          aria-hidden
          className={`grid place-items-center rounded-full bg-surface/90 font-bold text-ink ${
            compact ? "h-3.5 w-3.5 text-[10px]" : "h-5 w-5 text-xs"
          }`}
        >
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

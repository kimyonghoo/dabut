"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

/**
 * The fixed palette: exactly 8 presets, no arbitrary/custom hex picker.
 * Exported so other controls (e.g. SettingsQuickControls' palette panel)
 * can reuse the same swatch set rather than redefining it.
 */
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
  const swatchSize = compact ? "h-6 w-6" : "h-9 w-9";
  const gap = compact ? "gap-1.5" : "gap-3";

  return (
    <div
      role="radiogroup"
      aria-label={t("brandColor")}
      className={`flex items-center ${gap} ${compact ? "flex-nowrap overflow-x-auto" : "flex-wrap"}`}
    >
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
    </div>
  );
}

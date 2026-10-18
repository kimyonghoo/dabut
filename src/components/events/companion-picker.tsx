"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { inputClass } from "@/components/ui/field";
import {
  RELATION_KEYS,
  formatCompanions,
  parseCompanions,
  type RelationKey,
  type RelationLabels,
} from "@/lib/events/parse-companions";

const chipClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/**
 * One-tap relationship chip picker for the "누구랑" (companions) field.
 *
 * Renders toggle chips (multi-select) plus, when "기타" is selected, an inline
 * free-text input. The actual value submitted with the surrounding <form> is a
 * single plain string via a hidden input — `events.companions` stays a plain
 * text column with no schema change.
 */
export function CompanionPicker({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const t = useTranslations("events.companionOptions");
  const labels: RelationLabels = {
    spouse: t("spouse"),
    child: t("child"),
    friend: t("friend"),
    parents: t("parents"),
    siblings: t("siblings"),
    colleague: t("colleague"),
    other: t("other"),
  };

  const initial = parseCompanions(defaultValue, labels);
  const [selected, setSelected] = useState<RelationKey[]>(initial.selected);
  const [other, setOther] = useState(initial.other);

  const value = formatCompanions(selected, other, labels);

  function toggle(key: RelationKey) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const chipStyle = (active: boolean) =>
    `${chipClass} ${
      active ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink hover:bg-surface-2"
    }`;

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={t("groupLabel")} className="flex flex-wrap gap-2">
        {RELATION_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={selected.includes(key)}
            onClick={() => toggle(key)}
            className={chipStyle(selected.includes(key))}
          >
            {labels[key]}
          </button>
        ))}
      </div>

      {selected.includes("other") && (
        <input
          type="text"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder={t("otherPlaceholder")}
          aria-label={t("other")}
          className={inputClass}
        />
      )}

      <input type="hidden" name={name} value={value} />
    </div>
  );
}

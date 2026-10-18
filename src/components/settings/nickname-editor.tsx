"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Pencil, X } from "lucide-react";
import { updateDisplayName } from "@/lib/actions/profile";
import { NICKNAME_MAX_LENGTH } from "@/lib/auth/nickname-policy";
import { inputClass, errorClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";

/**
 * Inline-editable nickname field for Settings. Shows the current
 * `profiles.display_name` with an edit affordance; saving runs the same
 * validation/uniqueness rules as signup (updateDisplayName).
 */
export function NicknameEditor({
  initialName,
  onSaved,
}: {
  initialName: string;
  onSaved?: (name: string) => void;
}) {
  const t = useTranslations("nickname");
  // `initialName` arrives as "" on first render (the parent fetches it
  // asynchronously) and updates once the fetch resolves. Reading it directly
  // here — instead of copying it into state once at mount — means the
  // display always reflects the latest fetched/saved value instead of
  // freezing at whatever it was when this component first mounted.
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit() {
    setValue(initialName);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    if (pending) return;
    setEditing(false);
    setError(null);
    setValue(initialName);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateDisplayName(value);
      if (!result.ok) {
        setError(t.has(result.error) ? t(result.error) : t("failed"));
        return;
      }
      onSaved?.(result.displayName);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-ink">{initialName || t("placeholder")}</span>
        <button type="button" onClick={startEdit} className={buttonClass("secondary", "shrink-0 px-3 py-1.5 text-xs")}>
          <Pencil aria-hidden className="size-3.5" strokeWidth={2} /> {t("edit")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={NICKNAME_MAX_LENGTH}
          placeholder={t("placeholder")}
          disabled={pending}
          className={inputClass}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") cancel();
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          aria-label={t("save")}
          className={buttonClass("primary", "shrink-0 px-3 py-2")}
        >
          {pending ? <Spinner /> : <Check aria-hidden className="size-4" strokeWidth={2} />}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          aria-label={t("cancel")}
          className={buttonClass("ghost", "shrink-0 px-2 py-2")}
        >
          <X aria-hidden className="size-4" strokeWidth={2} />
        </button>
      </div>
      {error && (
        <p role="alert" className={errorClass}>
          {error}
        </p>
      )}
    </div>
  );
}

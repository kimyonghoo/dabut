"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { createCategory } from "@/lib/actions/categories";
import { Spinner } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { inputClass, errorClass } from "@/components/ui/field";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";
import { CATEGORY_EMOJI_CHOICES, categoryEmoji } from "@/components/ledger/category-emoji";

export type PickerCategory = { id: string; name: string; type: string; icon: string | null };

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-[0.97]";

/**
 * Category chips (radio group named `categoryId`) plus an inline "+ add"
 * mini form. The mini form is a plain <div> — it lives inside the
 * transaction <form>, so it must not be a nested <form>; its button is
 * type="button" and calls the Server Action directly.
 */
export function CategoryPicker({
  type,
  categories,
  selectedId,
  onSelect,
  onCreated,
}: {
  type: "expense" | "income";
  categories: PickerCategory[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onCreated: (category: PickerCategory) => void;
}) {
  const t = useTranslations("ledger");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(CATEGORY_EMOJI_CHOICES[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  // Switching expense/income closes the mini form.
  useEffect(() => {
    setOpen(false);
    setError(null);
  }, [type]);

  const trimmed = name.trim();

  function submit() {
    if (pending) return;
    if (!trimmed) {
      setError(t("categoryNameRequired"));
      return;
    }
    setError(null);
    startProgress();
    startTransition(async () => {
      try {
        const result = await createCategory({ type, name: trimmed, icon });
        if (result.error || !result.category) {
          setError(result.error ?? t("categoryNameRequired"));
          return;
        }
        onCreated(result.category);
        setName("");
        setIcon(CATEGORY_EMOJI_CHOICES[0]);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        doneProgress();
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter here must not submit the outer transaction form.
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-ink-muted">{t("category")}</legend>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <label key={category.id} className="cursor-pointer">
            <input
              type="radio"
              name="categoryId"
              value={category.id}
              checked={category.id === selectedId}
              onChange={() => onSelect(category.id)}
              required
              className="peer sr-only"
            />
            <span
              className={`${chipClass} border-line bg-surface text-ink peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand`}
            >
              <span aria-hidden>{categoryEmoji(category)}</span>
              {category.name}
            </span>
          </label>
        ))}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
            setError(null);
          }}
          className={`${chipClass} border-dashed ${
            open ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink-muted hover:bg-surface-2"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
        >
          {t("addCategory")}
        </button>
      </div>

      {open && (
        <div className="mt-1 flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-3">
          <div role="radiogroup" aria-label={t("categoryIcon")} className="grid grid-cols-6 gap-1.5">
            {CATEGORY_EMOJI_CHOICES.map((choice) => {
              const active = choice === icon;
              return (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setIcon(choice)}
                  className={`grid h-10 place-items-center rounded-xl text-xl transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    active ? "bg-brand-soft ring-2 ring-brand" : "bg-surface hover:bg-surface"
                  }`}
                >
                  <span aria-hidden>{choice}</span>
                  <span className="sr-only">{choice}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={12}
              placeholder={t("categoryNamePlaceholder")}
              aria-label={t("categoryName")}
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={submit}
              disabled={pending || !trimmed}
              aria-busy={pending}
              className={buttonClass("primary", "shrink-0")}
            >
              {pending && <Spinner />}
              {t("addCategorySubmit")}
            </button>
          </div>
          {error && (
            <p role="alert" className={errorClass}>
              {error}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}

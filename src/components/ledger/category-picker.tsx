"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { createCategory } from "@/lib/actions/categories";
import { Spinner } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { inputClass, errorClass } from "@/components/ui/field";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";
import { Plus } from "lucide-react";
import { CATEGORY_ICON_CHOICES, CategoryIcon } from "@/components/ledger/category-icon";

export type PickerCategory = { id: string; name: string; type: string; icon: string | null };

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-[0.97]";

/**
 * Category chips (radio group named `categoryId`) plus a "+ add" button that
 * opens a modal dialog (native <dialog>, same convention as
 * DeleteAccount — backdrop/Escape/outside-click close) with the name input
 * and a much larger icon grid than the old inline panel.
 *
 * The modal's own "추가" button calls the Server Action directly (type
 * "button") rather than nesting a <form> — this component deliberately
 * lives inside the transaction <form>, and a <dialog> renders in the top
 * layer, outside the normal DOM flow, which would make a nested <form>
 * especially confusing. Because of that, this component listens for the
 * ancestor form's own submit (via a ref + `.closest("form")`) to catch the
 * case where the user typed a new category name but submitted the outer
 * form without pressing "추가" first — otherwise that name would be
 * silently discarded.
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
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_CHOICES[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Guarded rather than calling showModal()/close() unconditionally:
    // every real browser supports them, but jsdom (unit tests) doesn't
    // implement HTMLDialogElement at all, so this falls back to toggling
    // the `open` attribute directly instead of throwing.
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.open = true;
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.open = false;
    }
  }, [open]);

  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  // Switching expense/income closes the modal.
  useEffect(() => {
    setOpen(false);
    setError(null);
  }, [type]);

  const trimmed = name.trim();

  // This component deliberately lives inside the transaction <form> (see
  // the note above), so it can't rely on its own onSubmit. Instead it finds
  // that ancestor form and listens for its submit event directly: if the
  // modal is open with a typed-but-never-submitted category name, block the
  // save, show an error, and focus the modal's own "추가" button instead of
  // silently discarding the typed name under whatever category was already
  // selected.
  useEffect(() => {
    const form = fieldsetRef.current?.closest("form");
    if (!form) return;
    function handleSubmit(event: SubmitEvent) {
      if (open && trimmed) {
        event.preventDefault();
        setError(t("categoryAddFirst"));
        addButtonRef.current?.focus();
      }
    }
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [open, trimmed, t]);

  function closeModal() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

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
        setIcon(CATEGORY_ICON_CHOICES[0]);
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
    }
  }

  return (
    <fieldset ref={fieldsetRef} className="flex flex-col gap-2">
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
              <CategoryIcon category={category} className="size-4" />
              {category.name}
            </span>
          </label>
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
            setError(null);
          }}
          className={`${chipClass} border-dashed ${
            open ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink-muted hover:bg-surface-2"
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
        >
          <Plus aria-hidden className="size-4" />
          {t("addCategory")}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeModal();
        }}
        className="m-auto w-[min(92vw,26rem)] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[85vh] flex-col gap-3 p-5">
          <h2 id={titleId} className="text-base font-bold text-ink">
            {t("addCategoryTitle")}
          </h2>

          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={onKeyDown}
            maxLength={12}
            placeholder={t("categoryNamePlaceholder")}
            aria-label={t("categoryName")}
            className={inputClass}
          />

          <div
            role="radiogroup"
            aria-label={t("categoryIcon")}
            className="grid max-h-[45vh] grid-cols-6 gap-1.5 overflow-y-auto pr-1"
          >
            {CATEGORY_ICON_CHOICES.map((choice) => {
              const active = choice === icon;
              return (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={choice}
                  onClick={() => setIcon(choice)}
                  className={`grid h-10 place-items-center rounded-xl text-ink transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    active ? "bg-brand-soft ring-2 ring-brand" : "bg-surface hover:bg-surface"
                  }`}
                >
                  <CategoryIcon iconKey={choice} className="size-5" />
                </button>
              );
            })}
          </div>

          {error && (
            <p role="alert" className={errorClass}>
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={closeModal} disabled={pending} className={buttonClass("ghost", "flex-1")}>
              {t("cancel")}
            </button>
            <button
              ref={addButtonRef}
              type="button"
              onClick={submit}
              disabled={pending || !trimmed}
              aria-busy={pending}
              className={buttonClass("primary", "flex-1")}
            >
              {pending && <Spinner />}
              {t("addCategorySubmit")}
            </button>
          </div>
        </div>
      </dialog>
    </fieldset>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  type PaymentMethod,
} from "@/lib/actions/payment-methods";
import { buttonClass } from "@/components/ui/button";
import { inputClass, errorClass } from "@/components/ui/field";
import { Spinner } from "@/components/ui/submit-button";

const DELETE_CONFIRM_MS = 3000;

// A small curated emoji set (plus "no icon") — mirrors CategoryPicker's
// curated-choices approach rather than a free-text field, so the settings
// list stays visually consistent.
const ICON_CHOICES = ["💳", "🏦", "💰", "🪙", "📱", "🎫", "✈️", "☕", "🛍️", "💵", "🚗", "🎮"] as const;

type DraftState = { name: string; icon: string; goal: string };

const EMPTY_DRAFT: DraftState = { name: "", icon: "", goal: "" };

function parseGoalInput(raw: string): { monthlyGoal: number | null } | { error: "invalidGoal" } {
  const trimmed = raw.trim();
  if (!trimmed) return { monthlyGoal: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { error: "invalidGoal" };
  return { monthlyGoal: value };
}

/**
 * Settings "지출수단" manager: list, add, edit, delete payment methods, and
 * set/edit each one's monthly performance goal. Follows this app's
 * established manager-component pattern (NicknameEditor / ConnectionManager):
 * receives an initial list as a prop, then owns its own local copy so
 * create/update/delete can update the UI immediately without a full refetch.
 */
export function PaymentMethodsManager({ initialMethods }: { initialMethods: PaymentMethod[] }) {
  const t = useTranslations("paymentMethods");
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods);
  // The parent (Settings page) fetches its own payment methods asynchronously
  // after mount, so `initialMethods` is "[]" on first render and only gets
  // its real value once that fetch resolves — a plain `useState(initialMethods)`
  // would miss that later arrival. Sync once, the first time real data shows
  // up; after that, this component's own create/update/delete handlers are
  // the sole source of truth for `methods` (the parent never refetches).
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    if (initialMethods.length > 0) {
      setMethods(initialMethods);
      syncedRef.current = true;
    }
  }, [initialMethods]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function friendlyError(code: string): string {
    return t.has(code) ? t(code) : t("failed");
  }

  function startAdd() {
    setDraft(EMPTY_DRAFT);
    setError(null);
    setEditingId("new");
  }

  function startEdit(method: PaymentMethod) {
    setDraft({ name: method.name, icon: method.icon ?? "", goal: method.monthlyGoal?.toString() ?? "" });
    setError(null);
    setEditingId(method.id);
  }

  function cancelEdit() {
    if (pending) return;
    setEditingId(null);
    setError(null);
  }

  function submit() {
    if (pending) return;
    const name = draft.name.trim();
    if (!name) {
      setError(t("nameRequired"));
      return;
    }
    const goalResult = parseGoalInput(draft.goal);
    if ("error" in goalResult) {
      setError(t(goalResult.error));
      return;
    }

    setError(null);
    startTransition(async () => {
      const input = { name, icon: draft.icon || null, monthlyGoal: goalResult.monthlyGoal };
      const result =
        editingId === "new" ? await createPaymentMethod(input) : await updatePaymentMethod(editingId!, input);
      if (result.error || !result.paymentMethod) {
        setError(friendlyError(result.error ?? "failed"));
        return;
      }
      const saved = result.paymentMethod;
      setMethods((prev) => {
        if (editingId === "new") return [...prev, saved];
        return prev.map((method) => (method.id === saved.id ? saved : method));
      });
      setEditingId(null);
    });
  }

  function handleDeleteClick(id: string) {
    if (pending) return;
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingDeleteId(null), DELETE_CONFIRM_MS);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingDeleteId(null);
    startTransition(async () => {
      const result = await deletePaymentMethod(id);
      if (result.error) {
        setError(friendlyError(result.error));
        return;
      }
      setMethods((prev) => prev.filter((method) => method.id !== id));
    });
  }

  function renderForm() {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-3">
        <div role="radiogroup" aria-label={t("iconLabel")} className="grid grid-cols-7 gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={draft.icon === ""}
            aria-label={t("noIcon")}
            onClick={() => setDraft((d) => ({ ...d, icon: "" }))}
            className={`grid h-10 place-items-center rounded-xl text-ink-muted transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              draft.icon === "" ? "bg-brand-soft ring-2 ring-brand" : "bg-surface hover:bg-surface"
            }`}
          >
            <CreditCard aria-hidden className="size-4" />
          </button>
          {ICON_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={draft.icon === choice}
              aria-label={choice}
              onClick={() => setDraft((d) => ({ ...d, icon: choice }))}
              className={`grid h-10 place-items-center rounded-xl text-lg transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                draft.icon === choice ? "bg-brand-soft ring-2 ring-brand" : "bg-surface hover:bg-surface"
              }`}
            >
              {choice}
            </button>
          ))}
        </div>

        <input
          autoFocus
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          maxLength={20}
          placeholder={t("namePlaceholder")}
          aria-label={t("nameLabel")}
          className={inputClass}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancelEdit();
          }}
        />

        <label className="flex items-baseline gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
          <span className="shrink-0 text-xs font-medium text-ink-muted">{t("goalLabel")}</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={draft.goal}
            onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value }))}
            placeholder={t("goalPlaceholder")}
            className="w-full min-w-0 bg-transparent text-right text-base font-semibold tabular-nums outline-none placeholder:text-ink-muted/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {/* Currency unit is always "원" (KRW) regardless of UI language,
              matching the hardcoded "원" on the ledger's own amount field
              in transaction-form.tsx. */}
          <span className="shrink-0 text-sm font-medium text-ink-muted">원</span>
        </label>

        {error && (
          <p role="alert" className={errorClass}>
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={cancelEdit} disabled={pending} className={buttonClass("ghost", "flex-1")}>
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            aria-busy={pending}
            className={buttonClass("primary", "flex-1")}
          >
            {pending && <Spinner />}
            {t("save")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && editingId === null && (
        <p role="alert" className={errorClass}>
          {error}
        </p>
      )}

      {methods.length === 0 && editingId !== "new" && <p className="text-sm text-ink-muted">{t("empty")}</p>}

      <ul className="flex flex-col gap-2">
        {methods.map((method) =>
          editingId === method.id ? (
            <li key={method.id}>{renderForm()}</li>
          ) : (
            <li
              key={method.id}
              className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-base">
                {method.icon ?? <CreditCard aria-hidden className="size-4 text-brand" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{method.name}</p>
                <p className="text-xs text-ink-muted">
                  {method.monthlyGoal != null
                    ? `${t("goalLabel")} ${method.monthlyGoal.toLocaleString("ko-KR")}원`
                    : t("noGoal")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(method)}
                className={buttonClass("secondary", "shrink-0 px-2.5 py-1.5 text-xs")}
              >
                <Pencil aria-hidden className="size-3.5" /> {t("edit")}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteClick(method.id)}
                disabled={pending}
                className={buttonClass("danger", "shrink-0 px-2.5 py-1.5 text-xs")}
              >
                <Trash2 aria-hidden className="size-3.5" />
                {confirmingDeleteId === method.id ? t("deleteConfirm") : t("delete")}
              </button>
            </li>
          )
        )}

        {editingId === "new" && <li>{renderForm()}</li>}
      </ul>

      {editingId !== "new" && (
        <button
          type="button"
          onClick={startAdd}
          className={buttonClass("secondary", "justify-center border border-dashed border-line bg-transparent")}
        >
          <Plus aria-hidden className="size-4" /> {t("addButton")}
        </button>
      )}
    </div>
  );
}

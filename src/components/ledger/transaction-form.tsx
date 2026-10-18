"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, Trash2 } from "lucide-react";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  type TransactionActionState,
} from "@/lib/actions/transactions";
import type { Database } from "@/types/database.types";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass, errorClass } from "@/components/ui/field";
import { SubmitButton, Spinner } from "@/components/ui/submit-button";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";
import { CategoryPicker, type PickerCategory } from "@/components/ledger/category-picker";
import { PaymentMethodPicker, type PickerPaymentMethod } from "@/components/ledger/payment-method-picker";

const DELETE_CONFIRM_MS = 3000;

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export function TransactionForm({
  mode,
  transaction,
  categories,
  paymentMethods = [],
}: {
  mode: "create" | "edit";
  transaction?: TransactionRow;
  categories: CategoryRow[];
  paymentMethods?: PickerPaymentMethod[];
}) {
  const t = useTranslations("ledger");
  const action = mode === "create" ? createTransaction : updateTransaction.bind(null, transaction!.id);
  const [state, formAction] = useActionState<TransactionActionState, FormData>(action, {});
  const [type, setType] = useState<"expense" | "income">(
    (transaction?.type as "expense" | "income") ?? "expense"
  );

  // Categories created inline are kept locally so they show up (selected)
  // immediately, without waiting for a server refresh.
  const [createdCategories, setCreatedCategories] = useState<PickerCategory[]>([]);
  const allCategories = useMemo(() => {
    const seen = new Set(categories.map((category) => category.id));
    return [...categories, ...createdCategories.filter((category) => !seen.has(category.id))];
  }, [categories, createdCategories]);
  const filteredCategories = allCategories.filter((category) => category.type === type);

  const [selectedByType, setSelectedByType] = useState<Partial<Record<"expense" | "income", string>>>(() =>
    transaction ? { [transaction.type as "expense" | "income"]: transaction.category_id } : {}
  );
  const selectedCategoryId =
    filteredCategories.find((category) => category.id === selectedByType[type])?.id ?? filteredCategories[0]?.id;

  const [deletePending, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    []
  );

  function onDeleteClick() {
    if (deletePending || !transaction) return;
    if (!confirmingDelete) {
      setDeleteError(null);
      setConfirmingDelete(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingDelete(false), DELETE_CONFIRM_MS);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingDelete(false);
    startProgress();
    startDelete(async () => {
      try {
        // On success the action redirects to the ledger (with a toast).
        const result = await deleteTransaction(transaction.id);
        if (result?.error) setDeleteError(result.error);
      } finally {
        doneProgress();
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const isIncome = type === "income";

  return (
    <form action={formAction} className="flex flex-col gap-5 pb-24">
      <header className="flex items-center gap-2 pt-2">
        <Link
          href="/ledger"
          aria-label={t("back")}
          className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition hover:bg-surface-2"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-ink">
          {mode === "create" ? t("newTitle") : t("editTitle")}
        </h1>
      </header>

      <fieldset className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        <legend className="sr-only">{t("type")}</legend>
        {(["expense", "income"] as const).map((value) => {
          const active = type === value;
          return (
            <label
              key={value}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-full py-2 text-center text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
                active
                  ? `bg-surface shadow-sm ${value === "income" ? "text-income" : "text-expense"}`
                  : "text-ink-muted"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={active}
                onChange={() => setType(value)}
                className="sr-only"
              />
              {value === "income" ? (
                <ArrowUpRight aria-hidden className="size-4" />
              ) : (
                <ArrowDownRight aria-hidden className="size-4" />
              )}
              {t(value)}
            </label>
          );
        })}
      </fieldset>

      <Card className="flex flex-col gap-1 p-5">
        <label htmlFor="tx-amount" className="text-sm font-medium text-ink-muted">
          {t("amount")}
        </label>
        <div className="flex items-baseline gap-2 border-b-2 border-line pb-1 focus-within:border-brand">
          <input
            id="tx-amount"
            type="number"
            name="amount"
            inputMode="numeric"
            placeholder="0"
            defaultValue={transaction?.amount}
            min="0.01"
            step="0.01"
            required
            className={`w-full min-w-0 bg-transparent text-right text-3xl font-extrabold tabular-nums outline-none placeholder:text-ink-muted/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
              isIncome ? "text-income" : "text-expense"
            }`}
          />
          <span className="text-xl font-bold text-ink">원</span>
        </div>
      </Card>

      <CategoryPicker
        type={type}
        categories={filteredCategories}
        selectedId={selectedCategoryId}
        onSelect={(id) => setSelectedByType((prev) => ({ ...prev, [type]: id }))}
        onCreated={(category) => {
          setCreatedCategories((prev) => [...prev, category]);
          setSelectedByType((prev) => ({ ...prev, [category.type]: category.id }));
        }}
      />

      <PaymentMethodPicker
        name="paymentMethodId"
        methods={paymentMethods}
        defaultValue={transaction?.payment_method_id ?? null}
      />

      <label className={labelClass}>
        {t("occurredAt")}
        <input
          type="date"
          name="occurredAt"
          defaultValue={transaction?.occurred_at ?? today}
          required
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        {t("memo")}
        <input type="text" name="memo" defaultValue={transaction?.memo ?? ""} className={inputClass} />
      </label>

      {state.error && (
        <p role="alert" className={errorClass}>
          {state.error}
        </p>
      )}

      <div className="sticky bottom-24 z-10 flex flex-col gap-2 bg-gradient-to-t from-bg via-bg to-transparent pt-3">
        <SubmitButton className="w-full py-3.5 text-base" disabled={deletePending}>
          {t("save")}
        </SubmitButton>
        {mode === "edit" && (
          <>
            <Button
              type="button"
              variant="danger"
              className="w-full"
              onClick={onDeleteClick}
              disabled={deletePending}
              aria-busy={deletePending}
            >
              {deletePending ? <Spinner /> : <Trash2 aria-hidden className="size-4" />}
              {confirmingDelete ? t("deleteConfirm") : t("delete")}
            </Button>
            {deleteError && (
              <p role="alert" className={errorClass}>
                {deleteError}
              </p>
            )}
          </>
        )}
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
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
import { categoryEmoji } from "@/components/ledger/category-emoji";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export function TransactionForm({
  mode,
  transaction,
  categories,
}: {
  mode: "create" | "edit";
  transaction?: TransactionRow;
  categories: CategoryRow[];
}) {
  const t = useTranslations("ledger");
  const action = mode === "create" ? createTransaction : updateTransaction.bind(null, transaction!.id);
  const [state, formAction] = useActionState<TransactionActionState, FormData>(action, {});
  const [type, setType] = useState<"expense" | "income">(
    (transaction?.type as "expense" | "income") ?? "expense"
  );

  const filteredCategories = categories.filter((category) => category.type === type);
  const defaultCategoryId =
    filteredCategories.find((category) => category.id === transaction?.category_id)?.id ??
    filteredCategories[0]?.id;
  const today = new Date().toISOString().slice(0, 10);
  const isIncome = type === "income";

  return (
    <form action={formAction} className="flex flex-col gap-5 pb-24">
      <header className="flex items-center gap-2 pt-2">
        <Link
          href="/ledger"
          aria-label={t("back")}
          className="grid h-9 w-9 place-items-center rounded-full text-lg text-ink-muted transition hover:bg-surface-2"
        >
          ←
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
              className={`cursor-pointer rounded-full py-2 text-center text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink-muted">{t("category")}</legend>
        <div key={type} className="flex flex-wrap gap-2">
          {filteredCategories.map((category) => (
            <label key={category.id} className="cursor-pointer">
              <input
                type="radio"
                name="categoryId"
                value={category.id}
                defaultChecked={category.id === defaultCategoryId}
                required
                className="peer sr-only"
              />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand active:scale-[0.97]">
                <span aria-hidden>{categoryEmoji(category.name)}</span>
                {category.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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
        <Button type="submit" className="w-full py-3.5 text-base">
          {t("save")}
        </Button>
        {mode === "edit" && (
          <Button type="button" variant="danger" className="w-full" onClick={() => deleteTransaction(transaction!.id)}>
            {t("delete")}
          </Button>
        )}
      </div>
    </form>
  );
}

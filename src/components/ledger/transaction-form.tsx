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
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction}>
      <fieldset>
        <label>
          <input
            type="radio"
            name="type"
            value="expense"
            checked={type === "expense"}
            onChange={() => setType("expense")}
          />
          {t("expense")}
        </label>
        <label>
          <input
            type="radio"
            name="type"
            value="income"
            checked={type === "income"}
            onChange={() => setType("income")}
          />
          {t("income")}
        </label>
      </fieldset>

      <label>
        {t("category")}
        <select name="categoryId" defaultValue={transaction?.category_id} required>
          {filteredCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        {t("amount")}
        <input type="number" name="amount" defaultValue={transaction?.amount} min="0.01" step="0.01" required />
      </label>

      <label>
        {t("memo")}
        <input type="text" name="memo" defaultValue={transaction?.memo ?? ""} />
      </label>

      <label>
        {t("occurredAt")}
        <input type="date" name="occurredAt" defaultValue={transaction?.occurred_at ?? today} required />
      </label>

      {state.error && <p role="alert">{state.error}</p>}

      <button type="submit">{t("save")}</button>
      {mode === "edit" && (
        <button type="button" onClick={() => deleteTransaction(transaction!.id)}>
          {t("delete")}
        </button>
      )}
    </form>
  );
}

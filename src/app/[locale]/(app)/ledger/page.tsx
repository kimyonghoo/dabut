import { format, startOfMonth, endOfMonth } from "date-fns";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { calculateMonthlyTotals } from "@/lib/ledger/calculate-totals";
import { Link } from "@/i18n/navigation";

export default async function LedgerPage() {
  const t = await getTranslations("ledger");
  const supabase = await createClient();

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, categories(name)")
    .gte("occurred_at", monthStart)
    .lte("occurred_at", monthEnd);

  const rows = transactions ?? [];
  const totals = calculateMonthlyTotals(
    rows.map((row) => ({ type: row.type as "expense" | "income", amount: row.amount }))
  );

  return (
    <main>
      <section>
        <p>
          {t("income_total")}: {totals.income}
        </p>
        <p>
          {t("expense_total")}: {totals.expense}
        </p>
        <p>
          {t("net_total")}: {totals.net}
        </p>
      </section>

      <Link href="/ledger/new">{t("newTransaction")}</Link>

      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/ledger/${row.id}/edit`}>
              {(row as unknown as { categories: { name: string } }).categories?.name} — {row.amount} —{" "}
              {row.memo} — {row.occurred_at}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

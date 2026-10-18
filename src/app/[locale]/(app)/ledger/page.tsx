import { format, startOfMonth, endOfMonth } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { calculateMonthlyTotals } from "@/lib/ledger/calculate-totals";
import { Link } from "@/i18n/navigation";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { categoryEmoji, formatWon } from "@/components/ledger/category-emoji";

function toUtcDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export default async function LedgerPage() {
  const t = await getTranslations("ledger");
  const locale = await getLocale();
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

  const monthTitle = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(now);
  const dayFormat = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });

  // Group by occurred_at (newest first).
  const groups = new Map<string, typeof rows>();
  for (const row of [...rows].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))) {
    const list = groups.get(row.occurred_at) ?? [];
    list.push(row);
    groups.set(row.occurred_at, list);
  }

  return (
    <main className="pb-24">
      <RealtimeRefresh table="transactions" />
      <PageHeader
        title={monthTitle}
        action={
          <Link href="/ledger/new" className={buttonClass("primary")}>
            {t("newTransaction")}
          </Link>
        }
      />

      <Card className="relative overflow-hidden bg-brand-soft p-5">
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand/15" />
        <div aria-hidden className="pointer-events-none absolute -bottom-8 right-10 h-16 w-16 rounded-full bg-partner/15" />
        <p className="text-sm font-medium text-ink-muted">{t("net_total")}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-ink">
          {totals.net < 0 ? "-" : ""}
          {formatWon(totals.net)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface/80 px-3 py-2.5">
            <p className="text-xs text-ink-muted">{t("income_total")}</p>
            <p className="mt-0.5 text-base font-bold text-income">+{formatWon(totals.income)}</p>
          </div>
          <div className="rounded-2xl bg-surface/80 px-3 py-2.5">
            <p className="text-xs text-ink-muted">{t("expense_total")}</p>
            <p className="mt-0.5 text-base font-bold text-expense">-{formatWon(totals.expense)}</p>
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-3xl" aria-hidden>
            🐷
          </span>
          <p className="font-semibold text-ink">{t("empty")}</p>
          <p className="text-sm text-ink-muted">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          {[...groups.entries()].map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2 px-1 text-xs font-semibold text-ink-muted">{dayFormat.format(toUtcDate(date))}</h2>
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                {items.map((row) => {
                  const name = (row as unknown as { categories: { name: string } | null }).categories?.name;
                  const isIncome = row.type === "income";
                  return (
                    <li key={row.id} className="border-b border-line last:border-b-0">
                      <Link
                        href={`/ledger/${row.id}/edit`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 active:bg-surface-2"
                      >
                        <span
                          aria-hidden
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${
                            isIncome ? "bg-shared-soft" : "bg-brand-soft"
                          }`}
                        >
                          {categoryEmoji(name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold text-ink">{name}</span>
                          {row.memo && <span className="block truncate text-xs text-ink-muted">{row.memo}</span>}
                        </span>
                        <span
                          className={`shrink-0 text-[15px] font-bold tabular-nums ${
                            isIncome ? "text-income" : "text-expense"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {formatWon(row.amount)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

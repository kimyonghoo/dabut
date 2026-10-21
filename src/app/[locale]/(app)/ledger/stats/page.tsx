import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { CategoryIcon, formatWon } from "@/components/ledger/category-icon";
import { PaymentMethodIcon } from "@/components/ledger/payment-method-icon";
import {
  rangeBounds,
  computeSavingsRate,
  computeCategoryShare,
  computePaymentMethodShare,
  computeMonthlyTrend,
  computeWeekdayPattern,
  computeTopExpenses,
  type StatsRange,
  type StatsTransaction,
} from "@/lib/ledger/stats";

const TREND_MONTHS = 6;
const RANGES: StatsRange[] = ["month", "3m", "6m", "1y"];

// dataviz reference categorical palette (validated order — see
// node_modules-free copy in docs/superpowers brainstorming notes), reused
// unchanged for the ranked category/payment-method bars.
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const SEQUENTIAL_BLUE = ["#cde2fb", "#9ec5f4", "#5598e7", "#2a78d6", "#184f95"];

type Row = {
  type: string;
  amount: number;
  occurred_at: string;
  memo: string | null;
  category_id: string;
  categories: { name: string; icon: string | null } | null;
  payment_method_id: string | null;
  payment_methods: { name: string; icon: string | null } | null;
};

export default async function LedgerStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: StatsRange = RANGES.includes(rangeParam as StatsRange) ? (rangeParam as StatsRange) : "3m";
  const t = await getTranslations("stats");
  const weekdayShort = t.raw("weekdayShort") as string[];

  const supabase = await createClient();
  const today = new Date();
  const { start: rangeStart, end: rangeEnd } = rangeBounds(range, today);
  const trendStart = rangeBounds("6m", today).start;
  const fetchStart = trendStart < rangeStart ? trendStart : rangeStart;

  const { data } = await supabase
    .from("transactions")
    .select(
      "type, amount, occurred_at, memo, category_id, categories(name, icon), payment_method_id, payment_methods(name, icon)"
    )
    .gte("occurred_at", fetchStart)
    .lte("occurred_at", rangeEnd);

  const transactions: StatsTransaction[] = ((data ?? []) as unknown as Row[]).map((row) => ({
    type: row.type as "expense" | "income",
    amount: Number(row.amount),
    occurredAt: row.occurred_at,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? null,
    categoryIcon: row.categories?.icon ?? null,
    paymentMethodId: row.payment_method_id,
    paymentMethodName: row.payment_methods?.name ?? null,
    memo: row.memo,
  }));

  const savings = computeSavingsRate(transactions, rangeStart, rangeEnd);
  const categoryShare = computeCategoryShare(transactions, rangeStart, rangeEnd, t("categoryShare"));
  const paymentMethodShare = computePaymentMethodShare(
    transactions,
    rangeStart,
    rangeEnd,
    t("paymentMethodUnassigned")
  );
  const trend = computeMonthlyTrend(transactions, TREND_MONTHS, today);
  const weekday = computeWeekdayPattern(transactions, rangeStart, rangeEnd);
  const top10 = computeTopExpenses(transactions, rangeStart, rangeEnd);

  const maxWeekday = Math.max(1, ...weekday.map((w) => w.amount));
  const peakWeekday = weekday.reduce((max, w) => (w.amount > max.amount ? w : max), weekday[0]);
  const maxTrendValue = Math.max(1, ...trend.flatMap((p) => [p.income, p.expense]));

  const savingsBadge =
    savings.ratePct == null
      ? null
      : savings.ratePct >= 20
        ? t("savingsGood")
        : savings.ratePct >= 0
          ? t("savingsWarning")
          : t("savingsCritical");

  const rangeLabel: Record<StatsRange, string> = {
    month: t("periodMonth"),
    "3m": t("period3m"),
    "6m": t("period6m"),
    "1y": t("period1y"),
  };

  return (
    <main className="flex flex-col gap-4 pb-8">
      <header className="flex items-center gap-2 pb-1 pt-2">
        <Link
          href="/ledger"
          aria-label={t("back")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-ink">{t("title")}</h1>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={{ pathname: "/ledger/stats", query: { range: r } }}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition ${
              r === range
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-muted hover:bg-surface-2"
            }`}
          >
            {rangeLabel[r]}
          </Link>
        ))}
      </div>

      {/* 총 저축률 */}
      <div className="rounded-[22px] bg-gradient-to-br from-brand to-[#ff9a6c] p-[18px] text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold opacity-90">{t("savingsRate")}</span>
          {savingsBadge && (
            <span className="rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-extrabold">{savingsBadge}</span>
          )}
        </div>
        {savings.income === 0 ? (
          <p className="mt-2 text-sm font-semibold opacity-90">{t("savingsNoIncome")}</p>
        ) : (
          <>
            <p className="mt-1 text-[40px] font-extrabold leading-none tabular-nums">
              {Math.round(savings.ratePct ?? 0)}%
            </p>
            <p className="mb-3 mt-1.5 text-xs opacity-90">
              {t("savingsRateHint", {
                income: formatWon(savings.income),
                saved: formatWon(savings.saved),
                expense: formatWon(savings.expense),
              })}
            </p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/25">
              <div
                className="bg-white"
                style={{ width: `${Math.max(0, Math.min(100, savings.ratePct ?? 0))}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* ① 항목별 지출 비중 */}
      <Card className="flex flex-col gap-0.5">
        <h3 className="text-sm font-extrabold text-ink">{t("categoryShare")}</h3>
        <p className="mb-3 text-[11px] text-ink-muted">{t("categoryShareHint")}</p>
        {categoryShare.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">{t("emptySection")}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {categoryShare.map((item, i) => (
              <li key={item.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <CategoryIcon category={{ name: item.name, icon: item.icon }} className="size-3.5 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    {formatWon(item.amount)} · {Math.round(item.pct)}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-md bg-surface-2">
                  <div
                    className="h-full rounded-md"
                    style={{ width: `${item.pct}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ② 기간별 수입/지출 추이 */}
      <Card className="flex flex-col gap-0.5">
        <h3 className="text-sm font-extrabold text-ink">{t("trend")}</h3>
        <p className="text-[11px] text-ink-muted">{t("trendHint")}</p>
        <div className="mb-2 mt-2 flex gap-3.5 text-[11px] font-bold text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-income" /> {t("income")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-expense" /> {t("expense")}
          </span>
        </div>
        <div className="flex h-36 items-end gap-2.5 px-0.5">
          {trend.map((point) => (
            <div key={point.monthKey} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5">
              <div className="flex h-full items-end gap-1">
                <div
                  className="w-2.5 rounded-t-sm bg-income"
                  style={{ height: `${(point.income / maxTrendValue) * 100}%` }}
                />
                <div
                  className="w-2.5 rounded-t-sm bg-expense"
                  style={{ height: `${(point.expense / maxTrendValue) * 100}%` }}
                />
              </div>
              <span className="mt-1 text-[10px] text-ink-muted">{format(new Date(`${point.monthKey}-01`), "M월")}</span>
              <span className={`text-[9px] font-extrabold ${point.net >= 0 ? "text-income" : "text-expense"}`}>
                {point.net >= 0 ? "+" : ""}
                {formatWon(point.net)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* ③ 결제수단별 통계 */}
      <Card className="flex flex-col gap-0.5">
        <h3 className="text-sm font-extrabold text-ink">{t("paymentMethodShare")}</h3>
        <p className="mb-3 text-[11px] text-ink-muted">{t("paymentMethodShareHint")}</p>
        {paymentMethodShare.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">{t("emptySection")}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {paymentMethodShare.map((item, i) => (
              <li key={item.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <PaymentMethodIcon icon={item.icon} className="size-3.5 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    {formatWon(item.amount)} · {Math.round(item.pct)}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-md bg-surface-2">
                  <div
                    className="h-full rounded-md"
                    style={{ width: `${item.pct}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ④ 요일별 지출 패턴 */}
      <Card className="flex flex-col gap-0.5">
        <h3 className="text-sm font-extrabold text-ink">{t("weekdayPattern")}</h3>
        <p className="mb-3 text-[11px] text-ink-muted">{t("weekdayPatternHint")}</p>
        {weekday.every((w) => w.amount === 0) ? (
          <p className="py-4 text-center text-sm text-ink-muted">{t("emptySection")}</p>
        ) : (
          <>
            <div className="flex h-[70px] items-end gap-1">
              {weekday.map((w) => {
                const intensity = w.amount / maxWeekday;
                const step = Math.min(SEQUENTIAL_BLUE.length - 1, Math.floor(intensity * SEQUENTIAL_BLUE.length));
                return (
                  <div
                    key={w.weekday}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${Math.max(6, intensity * 100)}%`,
                      background: w.amount === 0 ? "#f1e4da" : SEQUENTIAL_BLUE[step],
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex gap-1 text-center text-[10px] text-ink-muted">
              {weekdayShort.map((label) => (
                <span key={label} className="flex-1">
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-expense/10 px-3 py-2.5">
              <span aria-hidden>⚠️</span>
              <p className="text-xs font-bold text-expense">
                {t("weekdayPeak", { day: weekdayShort[peakWeekday.weekday] })}
              </p>
            </div>
          </>
        )}
      </Card>

      {/* ⑤ 소비 TOP 10 */}
      <Card className="flex flex-col gap-0.5">
        <h3 className="text-sm font-extrabold text-ink">{t("top10")}</h3>
        <p className="mb-2 text-[11px] text-ink-muted">{t("top10Hint", { count: top10.length })}</p>
        {top10.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">{t("emptySection")}</p>
        ) : (
          <ul className="flex flex-col">
            {top10.map((item, i) => (
              <li
                key={`${item.occurredAt}-${item.label}-${i}`}
                className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-none"
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                    i < 3 ? "bg-brand text-white" : "bg-surface-2 text-ink-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{item.label}</p>
                  <p className="text-[11px] text-ink-muted">
                    {item.categoryName} · {format(new Date(item.occurredAt), "M/d")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-ink">{formatWon(item.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

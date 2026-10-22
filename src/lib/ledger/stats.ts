import { format, startOfMonth, subMonths } from "date-fns";

export type StatsTransaction = {
  type: "expense" | "income";
  amount: number;
  occurredAt: string; // "yyyy-MM-dd"
  categoryId: string;
  categoryName: string | null;
  categoryIcon: string | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  memo: string | null;
};

export type StatsRange = "month" | "3m" | "6m" | "1y";

/** [start, end] (both inclusive, "yyyy-MM-dd") for a stats range ending today. */
export function rangeBounds(range: StatsRange, today: Date): { start: string; end: string } {
  const monthsBack: Record<StatsRange, number> = { month: 0, "3m": 2, "6m": 5, "1y": 11 };
  const start = startOfMonth(subMonths(today, monthsBack[range]));
  return { start: format(start, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
}

function inRange(occurredAt: string, start: string, end: string): boolean {
  return occurredAt >= start && occurredAt <= end;
}

export type SavingsRate = {
  income: number;
  expense: number;
  saved: number;
  /** null when there's no income to divide by — a rate would be meaningless, not zero. */
  ratePct: number | null;
};

/** (수입 - 지출) / 수입 * 100 over the range. */
export function computeSavingsRate(transactions: StatsTransaction[], start: string, end: string): SavingsRate {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (!inRange(tx.occurredAt, start, end)) continue;
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }
  const saved = income - expense;
  return { income, expense, saved, ratePct: income > 0 ? (saved / income) * 100 : null };
}

export type ShareItem = { id: string; name: string; icon: string | null; amount: number; pct: number };

const SHARE_TOP_N = 5;

/**
 * Expense totals grouped by `keyOf`, sorted descending, with everything past
 * the top N folded into a single "기타" (other) bucket — callers supply the
 * other-bucket id/name/icon via `otherLabel` since this is shared by both
 * the category and payment-method breakdowns.
 */
function computeShare(
  transactions: StatsTransaction[],
  start: string,
  end: string,
  keyOf: (tx: StatsTransaction) => { id: string; name: string; icon: string | null } | null,
  otherLabel: { id: string; name: string }
): ShareItem[] {
  const totals = new Map<string, { name: string; icon: string | null; amount: number }>();
  let grandTotal = 0;
  for (const tx of transactions) {
    if (tx.type !== "expense" || !inRange(tx.occurredAt, start, end)) continue;
    const key = keyOf(tx);
    if (!key) continue;
    grandTotal += tx.amount;
    const existing = totals.get(key.id);
    if (existing) existing.amount += tx.amount;
    else totals.set(key.id, { name: key.name, icon: key.icon, amount: tx.amount });
  }
  if (grandTotal === 0) return [];

  const sorted = [...totals.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.amount - a.amount);

  const top = sorted.slice(0, SHARE_TOP_N);
  const rest = sorted.slice(SHARE_TOP_N);
  const items: ShareItem[] = top.map((item) => ({
    id: item.id,
    name: item.name,
    icon: item.icon,
    amount: item.amount,
    pct: (item.amount / grandTotal) * 100,
  }));
  if (rest.length > 0) {
    const restTotal = rest.reduce((sum, item) => sum + item.amount, 0);
    items.push({
      id: otherLabel.id,
      name: `${otherLabel.name} (${rest.length})`,
      icon: null,
      amount: restTotal,
      pct: (restTotal / grandTotal) * 100,
    });
  }
  return items;
}

export function computeCategoryShare(
  transactions: StatsTransaction[],
  start: string,
  end: string,
  otherLabel: string
): ShareItem[] {
  return computeShare(
    transactions,
    start,
    end,
    (tx) => ({ id: tx.categoryId, name: tx.categoryName ?? tx.categoryId, icon: tx.categoryIcon }),
    { id: "__other__", name: otherLabel }
  );
}

export function computePaymentMethodShare(
  transactions: StatsTransaction[],
  start: string,
  end: string,
  unassignedLabel: string
): ShareItem[] {
  return computeShare(
    transactions,
    start,
    end,
    (tx) =>
      tx.paymentMethodId
        ? { id: tx.paymentMethodId, name: tx.paymentMethodName ?? tx.paymentMethodId, icon: null }
        : { id: "__none__", name: unassignedLabel, icon: null },
    { id: "__other__", name: unassignedLabel }
  );
}

export type MonthlyTrendPoint = { monthKey: string; income: number; expense: number; net: number };

/** Last `months` calendar months (oldest first), each month's income/expense totals. */
export function computeMonthlyTrend(transactions: StatsTransaction[], months: number, today: Date): MonthlyTrendPoint[] {
  const points: MonthlyTrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(today, i));
    const monthKey = format(monthStart, "yyyy-MM");
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (!tx.occurredAt.startsWith(monthKey)) continue;
      if (tx.type === "income") income += tx.amount;
      else expense += tx.amount;
    }
    points.push({ monthKey, income, expense, net: income - expense });
  }
  return points;
}

export type WeekdayPoint = { weekday: number; amount: number };

/** Expense totals by day-of-week (0=Sun..6=Sat), using each date's local weekday. */
export function computeWeekdayPattern(transactions: StatsTransaction[], start: string, end: string): WeekdayPoint[] {
  const totals = new Array(7).fill(0) as number[];
  for (const tx of transactions) {
    if (tx.type !== "expense" || !inRange(tx.occurredAt, start, end)) continue;
    const [y, m, d] = tx.occurredAt.split("-").map(Number);
    const weekday = new Date(y, m - 1, d).getDay();
    totals[weekday] += tx.amount;
  }
  return totals.map((amount, weekday) => ({ weekday, amount }));
}

export type TopExpense = {
  /** The memo if one was entered, otherwise the category name (a transaction has no separate "title" field). */
  label: string;
  amount: number;
  occurredAt: string;
  categoryName: string | null;
  categoryIcon: string | null;
};

export function computeTopExpenses(transactions: StatsTransaction[], start: string, end: string, limit = 10): TopExpense[] {
  return transactions
    .filter((tx) => tx.type === "expense" && inRange(tx.occurredAt, start, end))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((tx) => ({
      label: tx.memo?.trim() || tx.categoryName || "",
      amount: tx.amount,
      occurredAt: tx.occurredAt,
      categoryName: tx.categoryName,
      categoryIcon: tx.categoryIcon,
    }));
}

export const ENGEL_KEYWORDS = ["외식", "마트", "배달", "편의점"] as const;
export type EngelBandKey = "veryLow" | "low" | "normal" | "high" | "veryHigh";

export function engelBand(pct: number): EngelBandKey {
  if (pct < 20) return "veryLow";
  if (pct < 25) return "low";
  if (pct < 30) return "normal";
  if (pct < 35) return "high";
  return "veryHigh";
}

export type EngelIndex = {
  /** null when there is no expense in the range. */
  pct: number | null;
  food: number;
  total: number;
  band: EngelBandKey | null;
  breakdown: { name: string; amount: number }[];
};

/** (외식 + 마트 + 배달 + 편의점 지출) / 전체 지출 * 100 over the range. */
export function computeEngelIndex(transactions: StatsTransaction[], start: string, end: string): EngelIndex {
  let total = 0;
  const byKeyword = new Map<string, number>(ENGEL_KEYWORDS.map((k) => [k, 0]));
  for (const tx of transactions) {
    if (tx.type !== "expense" || !inRange(tx.occurredAt, start, end)) continue;
    total += tx.amount;
    const keyword = ENGEL_KEYWORDS.find((k) => tx.categoryName?.includes(k));
    if (keyword) byKeyword.set(keyword, (byKeyword.get(keyword) ?? 0) + tx.amount);
  }
  const breakdown = ENGEL_KEYWORDS.map((name) => ({ name: name as string, amount: byKeyword.get(name) ?? 0 }));
  const food = breakdown.reduce((s, b) => s + b.amount, 0);
  if (total === 0) return { pct: null, food, total, band: null, breakdown };
  const pct = Math.round((food / total) * 1000) / 10;
  return { pct, food, total, band: engelBand(pct), breakdown };
}

export type ShareTx = { date: string; label: string; sub: string; amount: number };
export type ShareGroup = { id: string; name: string; icon: string | null; amount: number; pct: number; txs: ShareTx[] };

/** Every group (no top-N cut, no "other" bucket) with its expense rows, biggest first — for drill-down sheets. */
export function computeShareGroups(
  transactions: StatsTransaction[],
  start: string,
  end: string,
  keyOf: (tx: StatsTransaction) => { id: string; name: string; icon: string | null },
  subOf: (tx: StatsTransaction) => string
): ShareGroup[] {
  const map = new Map<string, ShareGroup>();
  let grand = 0;
  for (const tx of transactions) {
    if (tx.type !== "expense" || !inRange(tx.occurredAt, start, end)) continue;
    const key = keyOf(tx);
    grand += tx.amount;
    let g = map.get(key.id);
    if (!g) {
      g = { id: key.id, name: key.name, icon: key.icon, amount: 0, pct: 0, txs: [] };
      map.set(key.id, g);
    }
    g.amount += tx.amount;
    g.txs.push({ date: tx.occurredAt, label: tx.memo?.trim() || subOf(tx), sub: subOf(tx), amount: tx.amount });
  }
  const groups = [...map.values()].sort((a, b) => b.amount - a.amount);
  for (const g of groups) {
    g.pct = grand === 0 ? 0 : (g.amount / grand) * 100;
    g.txs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.amount - a.amount));
  }
  return groups;
}

export const SHARE_VISIBLE = SHARE_TOP_N;

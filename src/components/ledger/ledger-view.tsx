"use client";

import { dragScrollRef } from "@/components/ui/drag-scroll";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BarChart3, CircleHelp, CreditCard, PiggyBank, Search, SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { FilterDisclosure } from "@/components/ui/filter-disclosure";
import { SwipeToDelete } from "@/components/swipe/swipe-to-delete";
import { useOptimisticRemoval } from "@/components/swipe/use-optimistic-removal";
import { CategoryIcon, formatWon } from "@/components/ledger/category-icon";
import { OwnershipLegend } from "@/components/ledger/ownership-legend";
import { BORDER_CLASSNAME } from "@/components/ledger/ownership-style";
import { PaymentMethodGoalsSheet } from "@/components/ledger/payment-method-goals-sheet";
import { PaymentMethodIcon } from "@/components/ledger/payment-method-icon";
import { calculateMonthlyTotals } from "@/lib/ledger/calculate-totals";
import { categorizeTransaction, type TransactionOwnership } from "@/lib/ledger/categorize-transaction";
import {
  filterByCategory,
  filterByOwner,
  filterByPaymentMethod,
  UNASSIGNED_PAYMENT_METHOD_ID,
  filterBySearch,
  groupByOccurredAt,
} from "@/lib/ledger/filter-by-category";
import { dateGroupLabel } from "@/lib/dates/relative-day";
import { useTodayKey } from "@/lib/dates/use-today-key";
import { quickDeleteTransaction } from "@/lib/actions/swipe-delete";

export type LedgerRow = {
  id: string;
  ownerId: string;
  type: "expense" | "income";
  amount: number;
  memo: string | null;
  occurredAt: string;
  categoryId: string;
  paymentMethodId: string | null;
  category: { name: string; icon: string | null } | null;
};

export type LedgerPaymentMethodGoal = { id: string; name: string; icon: string | null; monthlyGoal: number };

/** For the payment-method filter chips only — never carries `monthlyGoal`. */
export type LedgerPaymentMethodOption = { id: string; name: string; icon: string | null };

export type LedgerCategory = { id: string; name: string; icon: string | null; type: string };

const chipClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const FILTER_STORAGE_KEY = "dabut:ledger-filters";

export function LedgerView({
  rows,
  categories,
  currentUserId,
  serverTodayKey,
  hasPartner = false,
  partnerName = null,
  paymentMethodGoals = [],
  paymentMethods = [],
  monthlySpendingGoal = null,
}: {
  rows: LedgerRow[];
  categories: LedgerCategory[];
  currentUserId: string;
  serverTodayKey: string;
  /**
   * Whether this ledger can plausibly contain entries from someone other
   * than the viewer (i.e. the user has a connected partner). Transactions
   * have no "shared" ownership the way events do — every row is either
   * "mine" or "partner's" — so when there's no partner at all, that
   * distinction can never occur and showing color cues for it would just
   * be noise. Also gates the owner ("내 내역"/partner) filter row for the
   * same reason.
   */
  hasPartner?: boolean;
  partnerName?: string | null;
  /**
   * The current user's own payment methods that have a monthly goal set
   * (already filtered server-side — payment methods are personal and never
   * partner-visible). Drives the hero card's "카드실적" button, which is only
   * shown when this is non-empty.
   */
  paymentMethodGoals?: LedgerPaymentMethodGoal[];
  /**
   * Every payment method visible to the viewer — their own plus any
   * connected partner's shared ones (see
   * 0019_payment_methods_shared_visibility.sql) — for the payment-method
   * filter chips. Deliberately `{ id, name, icon }` only: this list must
   * never carry `monthlyGoal`, which stays private to whoever registered
   * the method.
   */
  paymentMethods?: LedgerPaymentMethodOption[];
  /** The couple's shared "이번 달 목표 지출액" (see lib/ledger/monthly-goal.ts); null when unset or unconnected. */
  monthlySpendingGoal?: number | null;
}) {
  const t = useTranslations("ledger");
  const tDates = useTranslations("dates");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const todayKey = useTodayKey(serverTodayKey);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [paymentMethodIds, setPaymentMethodIds] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<TransactionOwnership | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // 수정/상세 갔다가 돌아와도 필터 유지 (탭 세션 동안)
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          categoryIds?: string[];
          paymentMethodIds?: string[];
          ownerFilter?: TransactionOwnership | null;
          searchQuery?: string;
        };
        if (Array.isArray(saved.categoryIds)) setCategoryIds(saved.categoryIds);
        if (Array.isArray(saved.paymentMethodIds)) setPaymentMethodIds(saved.paymentMethodIds);
        if (saved.ownerFilter) setOwnerFilter(saved.ownerFilter);
        if (typeof saved.searchQuery === "string") setSearchQuery(saved.searchQuery);
      }
    } catch {
      // storage unavailable — filters just reset
    }
    setFiltersLoaded(true);
  }, []);
  useEffect(() => {
    if (!filtersLoaded) return;
    try {
      sessionStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({ categoryIds, paymentMethodIds, ownerFilter, searchQuery })
      );
    } catch {
      // ignore
    }
  }, [filtersLoaded, categoryIds, paymentMethodIds, ownerFilter, searchQuery]);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const { isRemoved, remove } = useOptimisticRemoval(quickDeleteTransaction, "transactionDeleted");

  const liveRows = rows.filter((row) => !isRemoved(row.id));
  // All four filter dimensions compose with AND logic: each stage narrows
  // whatever the previous stage kept. Category and payment method are both
  // multi-select (OR within the dimension, AND across dimensions).
  const filtered = filterBySearch(
    filterByOwner(
      filterByPaymentMethod(filterByCategory(liveRows, categoryIds), paymentMethodIds),
      hasPartner ? ownerFilter : null,
      currentUserId
    ),
    searchQuery
  );
  const unassignedCount = liveRows.filter((row) => row.type === "expense" && row.paymentMethodId == null).length;
  const totals = calculateMonthlyTotals(filtered.map((row) => ({ type: row.type, amount: row.amount })));
  const groups = groupByOccurredAt(filtered);

  function toggleCategory(id: string) {
    setCategoryIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  function togglePaymentMethod(id: string) {
    setPaymentMethodIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  // Drives the collapsed filter toggle's count badge, so it's clear filters
  // are still applied even while the panel is collapsed.
  const activeFilterCount =
    (categoryIds.length > 0 ? 1 : 0) +
    (paymentMethodIds.length > 0 ? 1 : 0) +
    (hasPartner && ownerFilter ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  // Spend per goal-having payment method, for this calendar month — computed
  // from the same month-scoped `liveRows` the hero totals use (the ledger
  // page only ever fetches the current month), independent of the category
  // filter above (카드실적 tracks the whole month, not a filtered slice).
  const goalItems = useMemo(
    () =>
      paymentMethodGoals.map((method) => ({
        ...method,
        spent: liveRows
          .filter((row) => row.paymentMethodId === method.id)
          .reduce((sum, row) => sum + row.amount, 0),
      })),
    [paymentMethodGoals, liveRows]
  );

  // Whole-month expense total, independent of the category/owner/search
  // filters above — the goal bar tracks the real month, same as 카드실적.
  const monthlyExpenseTotal = useMemo(
    () => liveRows.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount, 0),
    [liveRows]
  );
  const goalPct =
    monthlySpendingGoal && monthlySpendingGoal > 0 ? (monthlyExpenseTotal / monthlySpendingGoal) * 100 : null;

  // Chips: every visible category (defaults + custom), plus any category only
  // known through a row; categories in use this month come first.
  const chips = useMemo(() => {
    const byId = new Map<string, LedgerCategory>();
    for (const c of categories) byId.set(c.id, c);
    for (const row of rows) {
      if (!byId.has(row.categoryId) && row.category) {
        byId.set(row.categoryId, { id: row.categoryId, ...row.category, type: row.type });
      }
    }
    const countById = new Map<string, number>();
    for (const row of rows) countById.set(row.categoryId, (countById.get(row.categoryId) ?? 0) + 1);
    return [...byId.values()].sort((a, b) => {
      const countDiff = (countById.get(b.id) ?? 0) - (countById.get(a.id) ?? 0);
      if (countDiff !== 0) return countDiff;
      if (a.type !== b.type) return a.type === "expense" ? -1 : 1;
      return 0;
    });
  }, [categories, rows]);

  // Only the 10 most-used categories show by default — the rest are tucked
  // behind "더보기" to keep the filter row from sprawling. A category that's
  // already selected (filtering by something outside the top 10, e.g. after
  // switching months) stays visible regardless, so its chip is never an
  // active-but-invisible filter.
  const TOP_CHIP_COUNT = 10;
  const topChips = chips.slice(0, TOP_CHIP_COUNT);
  const hiddenChips = chips.slice(TOP_CHIP_COUNT).filter((c) => !categoryIds.includes(c.id));
  const forcedVisibleChips = chips.slice(TOP_CHIP_COUNT).filter((c) => categoryIds.includes(c.id));
  const visibleChips = chipsExpanded ? chips : [...topChips, ...forcedVisibleChips];

  const chipStyle = (active: boolean) =>
    `${chipClass} ${
      active ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink hover:bg-surface-2"
    }`;

  return (
    <>
      <Card className="relative overflow-hidden bg-brand-soft p-3.5">
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand/15" />
        <div aria-hidden className="pointer-events-none absolute -bottom-8 right-10 h-16 w-16 rounded-full bg-partner/15" />
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-2xl bg-surface/80 px-3 py-2">
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <p className="shrink-0 text-[11px] leading-tight text-ink-muted">{t("income_total")}</p>
              <p className="truncate text-sm font-bold leading-tight text-income">+{formatWon(totals.income)}</p>
            </div>
            <span aria-hidden className="h-px w-full shrink-0 bg-line" />
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <p className="shrink-0 text-[11px] leading-tight text-ink-muted">{t("expense_total")}</p>
              <p className="truncate text-sm font-bold leading-tight text-expense">-{formatWon(totals.expense)}</p>
            </div>
          </div>
          <div className="relative z-[1] flex shrink-0 flex-col items-stretch gap-1.5 self-center">
            {goalItems.length > 0 && (
              <button
                type="button"
                onClick={() => setGoalsOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-xs font-bold text-brand-strong shadow-sm transition active:scale-[0.97] hover:bg-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <CreditCard aria-hidden className="size-4" />
                {t("cardPerformance")}
              </button>
            )}
            <Link
              href="/ledger/stats"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-xs font-bold text-brand-strong shadow-sm transition active:scale-[0.97] hover:bg-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <BarChart3 aria-hidden className="size-4" />
              {t("stats")}
            </Link>
          </div>
        </div>
        {goalPct != null && (
          <div className="relative z-[1] mt-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink-muted">
              <span>{t("goalProgress")}</span>
              <span className={goalPct >= 100 ? "text-expense" : "text-brand-strong"}>{Math.floor(goalPct)}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full transition-[width] ${goalPct >= 100 ? "bg-expense" : "bg-gradient-to-r from-brand to-[#ff9a6c]"}`}
                style={{ width: `${Math.min(goalPct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      <PaymentMethodGoalsSheet open={goalsOpen} onClose={() => setGoalsOpen(false)} items={goalItems} />

      <div className="mt-4">
        <FilterDisclosure label={t("filtersLabel")} activeCount={activeFilterCount}>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className={`${inputClass} pl-9`}
            />
          </div>

          {chips.length > 0 && (
            <div
              role="group"
              aria-label={t("filterLabel")}
              // Horizontal scroller: stop the page-level tab swipe from hijacking it.
              ref={dragScrollRef}
              onPointerDownCapture={(event) => event.stopPropagation()}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                aria-pressed={categoryIds.length === 0}
                onClick={() => setCategoryIds([])}
                className={chipStyle(categoryIds.length === 0)}
              >
                {t("filterAll")}
              </button>
              {visibleChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={categoryIds.includes(chip.id)}
                  onClick={() => toggleCategory(chip.id)}
                  className={chipStyle(categoryIds.includes(chip.id))}
                >
                  <CategoryIcon category={chip} className="size-4" />
                  {chip.name}
                </button>
              ))}
              {hiddenChips.length > 0 && (
                <button
                  type="button"
                  onClick={() => setChipsExpanded((value) => !value)}
                  className={`${chipClass} border-dashed border-line text-ink-muted hover:bg-surface-2`}
                >
                  {chipsExpanded ? t("filterLess") : t("filterMore", { count: hiddenChips.length })}
                </button>
              )}
            </div>
          )}

          {paymentMethods.length > 0 && (
            <div
              role="group"
              aria-label={t("paymentMethodFilterLabel")}
              ref={dragScrollRef}
              onPointerDownCapture={(event) => event.stopPropagation()}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                aria-pressed={paymentMethodIds.length === 0}
                onClick={() => setPaymentMethodIds([])}
                className={chipStyle(paymentMethodIds.length === 0)}
              >
                {t("filterAll")}
              </button>
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={paymentMethodIds.includes(method.id)}
                  onClick={() => togglePaymentMethod(method.id)}
                  className={chipStyle(paymentMethodIds.includes(method.id))}
                >
                  <PaymentMethodIcon icon={method.icon} name={method.name} className="size-4" />
                  {method.name}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={paymentMethodIds.includes(UNASSIGNED_PAYMENT_METHOD_ID)}
                onClick={() => togglePaymentMethod(UNASSIGNED_PAYMENT_METHOD_ID)}
                className={chipStyle(paymentMethodIds.includes(UNASSIGNED_PAYMENT_METHOD_ID))}
              >
                <CircleHelp aria-hidden className="size-4" />
                {t("filterUnassigned")}
                <span className="text-xs opacity-70">{unassignedCount}</span>
              </button>
            </div>
          )}

          {hasPartner && (
            <div
              role="radiogroup"
              aria-label={t("ownerFilterLabel")}
              ref={dragScrollRef}
              onPointerDownCapture={(event) => event.stopPropagation()}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                role="radio"
                aria-checked={ownerFilter === null}
                onClick={() => setOwnerFilter(null)}
                className={chipStyle(ownerFilter === null)}
              >
                {t("filterAll")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={ownerFilter === "mine"}
                onClick={() => setOwnerFilter("mine")}
                className={chipStyle(ownerFilter === "mine")}
              >
                {t("filterMine")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={ownerFilter === "partner"}
                onClick={() => setOwnerFilter("partner")}
                className={chipStyle(ownerFilter === "partner")}
              >
                {partnerName ? t("filterPartnerNamed", { name: partnerName }) : t("filterPartner")}
              </button>
            </div>
          )}
        </FilterDisclosure>
      </div>

      {liveRows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
            <PiggyBank aria-hidden className="size-7" strokeWidth={1.75} />
          </span>
          <p className="font-semibold text-ink">{t("empty")}</p>
          <p className="text-sm text-ink-muted">{t("emptyHint")}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-ink-muted">
            <SearchX aria-hidden className="size-7" strokeWidth={1.75} />
          </span>
          <p className="font-semibold text-ink">{t("filterEmpty")}</p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {groups.map(({ date, items }) => (
            <section key={date}>
              <h2 className="mb-2 px-1 text-xs font-semibold text-ink-muted">
                {dateGroupLabel(date, todayKey, locale, (key) => tDates(key))}
              </h2>
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                {items.map((row) => {
                  const isIncome = row.type === "income";
                  const ownership = categorizeTransaction(row, currentUserId);
                  return (
                    <li
                      key={row.id}
                      className={`border-b border-line last:border-b-0 ${
                        hasPartner ? `border-l-4 ${BORDER_CLASSNAME[ownership]}` : ""
                      }`}
                    >
                      <SwipeToDelete
                        disabled={row.ownerId !== currentUserId}
                        deleteLabel={tCommon("delete")}
                        onDelete={() => remove(row.id)}
                        contentClassName="bg-surface"
                      >
                        <Link
                          href={`/ledger/${row.id}/edit`}
                          draggable={false}
                          className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 active:bg-surface-2"
                        >
                          <span
                            className={`grid size-10 shrink-0 place-items-center rounded-full ${
                              isIncome ? "bg-income/10 text-income" : "bg-brand-soft text-brand"
                            }`}
                          >
                            <CategoryIcon category={row.category} className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold text-ink">{row.category?.name}</span>
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
                      </SwipeToDelete>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasPartner && liveRows.length > 0 && (
        <div className="mt-4">
          <OwnershipLegend partnerName={partnerName} />
        </div>
      )}
    </>
  );
}

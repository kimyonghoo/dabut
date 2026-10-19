"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, PiggyBank, Search, SearchX } from "lucide-react";
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

export function LedgerView({
  rows,
  categories,
  currentUserId,
  serverTodayKey,
  hasPartner = false,
  partnerName = null,
  paymentMethodGoals = [],
  paymentMethods = [],
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
}) {
  const t = useTranslations("ledger");
  const tDates = useTranslations("dates");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const todayKey = useTodayKey(serverTodayKey);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<TransactionOwnership | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [goalsOpen, setGoalsOpen] = useState(false);
  const { isRemoved, remove } = useOptimisticRemoval(quickDeleteTransaction, "transactionDeleted");

  const liveRows = rows.filter((row) => !isRemoved(row.id));
  // All four filter dimensions compose with AND logic: each stage narrows
  // whatever the previous stage kept.
  const filtered = filterBySearch(
    filterByOwner(
      filterByPaymentMethod(filterByCategory(liveRows, categoryId), paymentMethodId),
      hasPartner ? ownerFilter : null,
      currentUserId
    ),
    searchQuery
  );
  const totals = calculateMonthlyTotals(filtered.map((row) => ({ type: row.type, amount: row.amount })));
  const groups = groupByOccurredAt(filtered);

  // Drives the collapsed filter toggle's count badge, so it's clear filters
  // are still applied even while the panel is collapsed.
  const activeFilterCount =
    (categoryId ? 1 : 0) +
    (paymentMethodId ? 1 : 0) +
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

  const paymentMethodById = useMemo(() => {
    const byId = new Map<string, LedgerPaymentMethodOption>();
    for (const method of paymentMethods) byId.set(method.id, method);
    return byId;
  }, [paymentMethods]);

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
    const used = new Set(rows.map((row) => row.categoryId));
    return [...byId.values()].sort((a, b) => {
      const usedDiff = Number(used.has(b.id)) - Number(used.has(a.id));
      if (usedDiff !== 0) return usedDiff;
      if (a.type !== b.type) return a.type === "expense" ? -1 : 1;
      return 0;
    });
  }, [categories, rows]);

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
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-surface/80 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-tight text-ink-muted">{t("income_total")}</p>
              <p className="truncate text-sm font-bold leading-tight text-income">+{formatWon(totals.income)}</p>
            </div>
            <span aria-hidden className="h-6 w-px shrink-0 bg-line" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-tight text-ink-muted">{t("expense_total")}</p>
              <p className="truncate text-sm font-bold leading-tight text-expense">-{formatWon(totals.expense)}</p>
            </div>
          </div>
          {goalItems.length > 0 && (
            <button
              type="button"
              onClick={() => setGoalsOpen(true)}
              className="relative z-[1] inline-flex shrink-0 items-center gap-1.5 self-center rounded-full bg-surface px-3.5 py-2 text-xs font-bold text-brand-strong shadow-sm transition active:scale-[0.97] hover:bg-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <CreditCard aria-hidden className="size-4" />
              {t("cardPerformance")}
            </button>
          )}
        </div>
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
              role="radiogroup"
              aria-label={t("filterLabel")}
              // Horizontal scroller: stop the page-level tab swipe from hijacking it.
              onPointerDownCapture={(event) => event.stopPropagation()}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                role="radio"
                aria-checked={categoryId === null}
                onClick={() => setCategoryId(null)}
                className={chipStyle(categoryId === null)}
              >
                {t("filterAll")}
              </button>
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  role="radio"
                  aria-checked={categoryId === chip.id}
                  onClick={() => setCategoryId(chip.id)}
                  className={chipStyle(categoryId === chip.id)}
                >
                  <CategoryIcon category={chip} className="size-4" />
                  {chip.name}
                </button>
              ))}
            </div>
          )}

          {paymentMethods.length > 0 && (
            <div
              role="radiogroup"
              aria-label={t("paymentMethodFilterLabel")}
              onPointerDownCapture={(event) => event.stopPropagation()}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                role="radio"
                aria-checked={paymentMethodId === null}
                onClick={() => setPaymentMethodId(null)}
                className={chipStyle(paymentMethodId === null)}
              >
                {t("filterAll")}
              </button>
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethodId === method.id}
                  onClick={() => setPaymentMethodId(method.id)}
                  className={chipStyle(paymentMethodId === method.id)}
                >
                  <PaymentMethodIcon icon={method.icon} className="size-4" />
                  {method.name}
                </button>
              ))}
            </div>
          )}

          {hasPartner && (
            <div
              role="radiogroup"
              aria-label={t("ownerFilterLabel")}
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
                  const paymentMethod = row.paymentMethodId ? paymentMethodById.get(row.paymentMethodId) : undefined;
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
                            <span className="flex items-baseline gap-1 truncate">
                              <span className="text-[15px] font-semibold text-ink">{row.category?.name}</span>
                              {paymentMethod && (
                                <span className="flex items-center gap-0.5 truncate text-xs text-ink-muted">
                                  <span aria-hidden>·</span>
                                  <PaymentMethodIcon icon={paymentMethod.icon} className="size-3" />
                                  {paymentMethod.name}
                                </span>
                              )}
                            </span>
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

import { categorizeTransaction, type TransactionOwnership } from "./categorize-transaction";
import { matchesSearchQuery } from "@/lib/search/matches-search-query";

export type FilterableTransaction = { categoryId: string; occurredAt: string };

/** Empty array = all categories. Multi-select: a row matches if its category is any of `categoryIds`. */
export function filterByCategory<T extends FilterableTransaction>(rows: T[], categoryIds: readonly string[]): T[] {
  if (categoryIds.length === 0) return rows;
  const selected = new Set(categoryIds);
  return rows.filter((row) => selected.has(row.categoryId));
}

export type FilterableByPaymentMethod = { paymentMethodId: string | null };

/**
 * Empty array = all payment methods. Multi-select: a row matches if its
 * payment method is any of `paymentMethodIds`. A row with no payment method
 * tagged (`paymentMethodId: null`) only ever shows under "all" — it never
 * matches a specific method filter.
 */
export function filterByPaymentMethod<T extends FilterableByPaymentMethod>(
  rows: T[],
  paymentMethodIds: readonly string[]
): T[] {
  if (paymentMethodIds.length === 0) return rows;
  const selected = new Set(paymentMethodIds);
  return rows.filter((row) => row.paymentMethodId != null && selected.has(row.paymentMethodId));
}

export type FilterableByOwner = { ownerId: string };

/**
 * `null` = everyone (mine + partner's). Otherwise keeps only rows whose
 * ownership — per the same `categorizeTransaction` used for the ledger's
 * ownership color-coding, not a re-derived check — matches `owner`.
 */
export function filterByOwner<T extends FilterableByOwner>(
  rows: T[],
  owner: TransactionOwnership | null,
  currentUserId: string
): T[] {
  if (!owner) return rows;
  return rows.filter((row) => categorizeTransaction(row, currentUserId) === owner);
}

export type SearchableTransaction = { memo: string | null; category: { name: string } | null };

/**
 * Case-insensitive match against memo text and/or category name. An
 * empty/whitespace-only query matches everything.
 */
export function filterBySearch<T extends SearchableTransaction>(rows: T[], query: string): T[] {
  if (!query.trim()) return rows;
  return rows.filter((row) => matchesSearchQuery(query, row.memo, row.category?.name));
}

/** Group by `occurredAt` (yyyy-MM-dd), newest day first; order within a day is preserved. */
export function groupByOccurredAt<T extends FilterableTransaction>(rows: T[]): Array<{ date: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.occurredAt) ?? [];
    list.push(row);
    groups.set(row.occurredAt, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({ date, items }));
}

import { categorizeTransaction, type TransactionOwnership } from "./categorize-transaction";
import { matchesSearchQuery } from "@/lib/search/matches-search-query";

export type FilterableTransaction = { categoryId: string; occurredAt: string };

/** `null` = all categories. */
export function filterByCategory<T extends FilterableTransaction>(rows: T[], categoryId: string | null): T[] {
  if (!categoryId) return rows;
  return rows.filter((row) => row.categoryId === categoryId);
}

export type FilterableByPaymentMethod = { paymentMethodId: string | null };

/**
 * `null` = all payment methods. A row with no payment method tagged
 * (`paymentMethodId: null`) only ever shows under "all" — it never matches
 * a specific method filter, even though that filter's value is also
 * `null`-ish in spirit; the two `null`s mean different things ("show
 * everything" vs. "this row has nothing to match").
 */
export function filterByPaymentMethod<T extends FilterableByPaymentMethod>(
  rows: T[],
  paymentMethodId: string | null
): T[] {
  if (!paymentMethodId) return rows;
  return rows.filter((row) => row.paymentMethodId === paymentMethodId);
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

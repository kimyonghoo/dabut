export type FilterableTransaction = { categoryId: string; occurredAt: string };

/** `null` = all categories. */
export function filterByCategory<T extends FilterableTransaction>(rows: T[], categoryId: string | null): T[] {
  if (!categoryId) return rows;
  return rows.filter((row) => row.categoryId === categoryId);
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

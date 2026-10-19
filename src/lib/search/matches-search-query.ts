/**
 * Case-insensitive substring match against one or more text fields, shared
 * by every list-level text search in the app (ledger memo/category search,
 * calendar thread-view title search, ...). An empty/whitespace-only query
 * matches everything, so "no search typed yet" shows the full list.
 * `null`/`undefined` fields are treated as empty strings rather than being
 * skipped, so a query never "accidentally" matches a row just because one
 * of its fields is missing.
 */
export function matchesSearchQuery(query: string, ...fields: Array<string | null | undefined>): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(normalizedQuery));
}

import { matchesSearchQuery } from "@/lib/search/matches-search-query";

export type SearchableEvent = { title: string };

/** Case-insensitive title match. An empty/whitespace-only query matches everything. */
export function filterEventsBySearch<T extends SearchableEvent>(events: T[], query: string): T[] {
  if (!query.trim()) return events;
  return events.filter((event) => matchesSearchQuery(query, event.title));
}

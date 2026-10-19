export type EventOwnerFilter = "mine" | "partner";

export type FilterableByEventCategory = { category: "mine" | "partner" | "shared" };

/**
 * `null` = everyone (mine + partner's + shared). A 공통(shared) event isn't
 * "owned" by either side exclusively — matching the day-summary sheet's
 * precedent of showing a shared event identically under both the viewer's
 * and the partner's section, it passes under *either* "mine" or "partner"
 * here too, rather than being orphaned under neither.
 */
export function filterEventsByOwner<T extends FilterableByEventCategory>(
  events: T[],
  owner: EventOwnerFilter | null
): T[] {
  if (!owner) return events;
  return events.filter((event) => event.category === owner || event.category === "shared");
}

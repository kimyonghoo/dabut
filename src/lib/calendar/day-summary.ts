export type DaySummaryEvent = {
  id: string;
  owner_id: string;
  title: string;
  all_day: boolean;
  start_at: string;
  end_at: string | null;
};

/** True when the event overlaps the local calendar day `day`. */
export function isDayWithinEvent(day: Date, event: Pick<DaySummaryEvent, "start_at" | "end_at">): boolean {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : start;
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

/**
 * Order for a day summary: all-day events first, then timed events by start
 * time, ties broken by title so the order is stable.
 */
export function compareDayEvents(a: DaySummaryEvent, b: DaySummaryEvent): number {
  if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
  if (!a.all_day) {
    const diff = new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    if (diff !== 0) return diff;
  }
  return a.title.localeCompare(b.title);
}

/**
 * Picks the events that touch `day` and splits them by owner: events owned
 * by `currentUserId` are "mine", everything else is the partner's. Shared
 * events are attributed to whoever owns them.
 */
export function splitDayEvents<T extends DaySummaryEvent>(
  events: readonly T[],
  day: Date,
  currentUserId: string
): { mine: T[]; partner: T[] } {
  const mine: T[] = [];
  const partner: T[] = [];
  for (const event of events) {
    if (!isDayWithinEvent(day, event)) continue;
    (event.owner_id === currentUserId ? mine : partner).push(event);
  }
  mine.sort(compareDayEvents);
  partner.sort(compareDayEvents);
  return { mine, partner };
}

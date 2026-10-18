import { zonedDateTimeToUtcIso } from "@/lib/dates/timezone";

export type DaySummaryEvent = {
  id: string;
  owner_id: string;
  title: string;
  all_day: boolean;
  start_at: string;
  end_at: string | null;
};

/**
 * True when the event overlaps the calendar day `day` (a plain Y/M/D,
 * timezone-less) as that day exists in `timeZone` — i.e. the viewing user's
 * real-world "today", not the server's or browser's ambient offset.
 */
export function isDayWithinEvent(
  day: Date,
  event: Pick<DaySummaryEvent, "start_at" | "end_at">,
  timeZone: string
): boolean {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : start;
  const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
    day.getDate()
  ).padStart(2, "0")}`;
  const dayStart = new Date(zonedDateTimeToUtcIso(dateStr, "00:00:00", timeZone));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
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
  currentUserId: string,
  timeZone: string
): { mine: T[]; partner: T[] } {
  const mine: T[] = [];
  const partner: T[] = [];
  for (const event of events) {
    if (!isDayWithinEvent(day, event, timeZone)) continue;
    (event.owner_id === currentUserId ? mine : partner).push(event);
  }
  mine.sort(compareDayEvents);
  partner.sort(compareDayEvents);
  return { mine, partner };
}

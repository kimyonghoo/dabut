import { toZonedDateInputValue, zonedDateTimeToUtcIso } from "@/lib/dates/timezone";

export type DaySummaryEvent = {
  id: string;
  owner_id: string;
  title: string;
  all_day: boolean;
  start_at: string;
  end_at: string | null;
  visibility: string;
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
 * True when `event`'s start and end land on different calendar days in
 * `timeZone` — i.e. it's a genuinely multi-day event (spans a day boundary
 * in the viewing timezone), not just a same-day event that happens to run
 * into the evening. Shared by the month grid's spanning-bar rendering and
 * the day-summary sheet's multi-day row layout so both agree on which
 * events count as "multi-day".
 */
export function isMultiDayEvent(
  event: Pick<DaySummaryEvent, "start_at" | "end_at">,
  timeZone: string
): boolean {
  if (!event.end_at) return false;
  return toZonedDateInputValue(event.start_at, timeZone) !== toZonedDateInputValue(event.end_at, timeZone);
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
 * Picks the events that touch `day` and splits them into three sections:
 * personal events owned by `currentUserId` ("mine"), personal events owned
 * by the partner ("partner"), and `shared` events ("같이 하는 일정"), each
 * shared event appearing exactly once in `shared` regardless of owner.
 */
export function splitDayEvents<T extends DaySummaryEvent>(
  events: readonly T[],
  day: Date,
  currentUserId: string,
  timeZone: string
): { mine: T[]; partner: T[]; shared: T[] } {
  const mine: T[] = [];
  const partner: T[] = [];
  const shared: T[] = [];
  for (const event of events) {
    if (!isDayWithinEvent(day, event, timeZone)) continue;
    if (event.visibility === "shared") {
      shared.push(event);
    } else {
      (event.owner_id === currentUserId ? mine : partner).push(event);
    }
  }
  mine.sort(compareDayEvents);
  partner.sort(compareDayEvents);
  shared.sort(compareDayEvents);
  return { mine, partner, shared };
}

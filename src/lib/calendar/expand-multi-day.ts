import { toZonedDateInputValue, toZonedTimeInputValue } from "@/lib/dates/timezone";

export type DayPart = "single" | "first" | "middle" | "last";

export type ExpandableEvent = {
  start_at: string;
  end_at: string | null;
  all_day: boolean;
};

export type DayEntry<T> = {
  /** "yyyy-MM-dd" in the viewing timezone. */
  date: string;
  event: T;
  dayPart: DayPart;
  /** True on the last day when a timed event ends exactly at 00:00 of the following day (shown as "~24:00"). */
  endsAtMidnight: boolean;
};

const MAX_DAYS = 400;

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Expands each event into one entry per calendar day (in `timeZone`) it
 * covers. Single-day events yield one "single" entry; multi-day events yield
 * "first", "middle"..., "last". A timed event ending exactly at 00:00 of a
 * later day does not claim that later day: it ends on the previous day with
 * `endsAtMidnight`. Event ids/objects are passed through untouched.
 */
export function expandEventsByDay<T extends ExpandableEvent>(events: readonly T[], timeZone: string): DayEntry<T>[] {
  const out: DayEntry<T>[] = [];
  for (const event of events) {
    const startKey = toZonedDateInputValue(event.start_at, timeZone);
    let endKey = event.end_at ? toZonedDateInputValue(event.end_at, timeZone) : startKey;
    let endsAtMidnight = false;
    if (
      event.end_at &&
      !event.all_day &&
      endKey > startKey &&
      toZonedTimeInputValue(event.end_at, timeZone) === "00:00" &&
      new Date(event.end_at).getTime() % 60000 === 0
    ) {
      endKey = addDays(endKey, -1);
      endsAtMidnight = true;
    }
    if (endKey <= startKey) {
      out.push({ date: startKey, event, dayPart: "single", endsAtMidnight: false });
      continue;
    }
    let key = startKey;
    for (let i = 0; i < MAX_DAYS && key <= endKey; i++, key = addDays(key, 1)) {
      const dayPart: DayPart = key === startKey ? "first" : key === endKey ? "last" : "middle";
      out.push({ date: key, event, dayPart, endsAtMidnight: dayPart === "last" && endsAtMidnight });
    }
  }
  return out;
}

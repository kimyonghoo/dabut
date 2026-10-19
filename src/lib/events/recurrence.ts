import { zonedDateParts, zonedDateTimeToUtcIso } from "@/lib/dates/timezone";
import { buildOccurrenceId } from "./occurrence-id";

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";
export type RecurrenceEndType = "never" | "until" | "count";

export type RecurrenceRule = {
  freq: RecurrenceFreq;
  /** Repeat every N units (e.g. 2 for "every 2 weeks" / 사용자 설정); 1 for a plain, non-custom frequency. */
  interval: number;
  endType: RecurrenceEndType;
  /** yyyy-MM-dd, inclusive, in the parent event's own timezone. Only meaningful when endType === "until". */
  until?: string | null;
  /** Only meaningful when endType === "count". */
  count?: number | null;
};

export type RecurringSourceEvent = {
  id: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
};

export type ComputedOccurrence = {
  /** Synthetic id, see occurrence-id.ts — this is not a real `events` row. */
  id: string;
  parentEventId: string;
  /** This cycle's original wall-clock date (yyyy-MM-dd, parent's timezone) — stable across edits, used to key exceptions. */
  occurrenceDate: string;
  /** 0-based position in the series; 0 is the parent row's own original start date. */
  index: number;
  start_at: string;
  end_at: string | null;
};

/** Inclusive calendar-date range (yyyy-MM-dd), interpreted in the same timezone the expansion runs in. */
export type DateRange = { start: string; end: string };

/**
 * Safety cap for an indefinitely-recurring ("안 함"/never ends) series:
 * expansion never produces occurrences more than this many years past the
 * series' own start, regardless of how far `range` reaches. This is the
 * "cap rather than truly infinite" behavior real calendar apps use —
 * comfortably beyond any realistic UI horizon (a month view, or a few years
 * of list view), while keeping expansion bounded even if a caller asks for
 * an absurdly wide range.
 */
export const MAX_RECURRENCE_HORIZON_YEARS = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DateParts = { year: number; month: number; day: number };

function dayNumber(parts: DateParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY;
}

function partsFromDayNumber(dayNum: number): DateParts {
  const d = new Date(dayNum * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the month *after* `month` is the last calendar day of `month`.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(parts: DateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function parseDateKey(key: string): DateParts {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

/**
 * The calendar date (parent's own wall-clock, not a fixed day-count) of the
 * `index`-th occurrence (0-based; 0 = the series' own original start date).
 * Monthly/yearly recurrence clamps to the shorter month's last day when the
 * original day-of-month doesn't exist there (e.g. "every month on the
 * 31st" lands on Feb 28/29, Apr 30, Jun 30, ...; "every year on Feb 29"
 * lands on Feb 28 in non-leap years) — the same clamp-to-last-day behavior
 * Google/Samsung Calendar use, rather than skipping the month/year entirely
 * or rolling into the next one.
 */
function occurrenceDateForIndex(
  freq: RecurrenceFreq,
  interval: number,
  origin: DateParts,
  index: number
): DateParts {
  if (freq === "daily") {
    return partsFromDayNumber(dayNumber(origin) + index * interval);
  }
  if (freq === "weekly") {
    return partsFromDayNumber(dayNumber(origin) + index * interval * 7);
  }
  if (freq === "monthly") {
    const totalMonths = origin.year * 12 + (origin.month - 1) + index * interval;
    const year = Math.floor(totalMonths / 12);
    const month = (totalMonths % 12) + 1;
    return { year, month, day: Math.min(origin.day, daysInMonth(year, month)) };
  }
  // yearly
  const year = origin.year + index * interval;
  return { year, month: origin.month, day: Math.min(origin.day, daysInMonth(year, origin.month)) };
}

/**
 * Rough index bounds (with a small safety margin) that could possibly land
 * inside `range`, computed directly from `range`'s endpoints rather than by
 * iterating cycle-by-cycle from the series' real (possibly years-earlier)
 * start — the per-occurrence date is a pure function of its index (see
 * `occurrenceDateForIndex`), so there is no need to walk every prior cycle
 * to reach a far-future range. Monthly/yearly bounds ignore day-of-month
 * clamping (which only ever shifts a date *within* its already-targeted
 * month/year) and widen by one extra cycle either side to compensate; the
 * caller filters to the exact computed date regardless.
 */
function estimateIndexBounds(
  freq: RecurrenceFreq,
  interval: number,
  origin: DateParts,
  range: DateRange
): { min: number; max: number } {
  const rangeStart = parseDateKey(range.start);
  const rangeEnd = parseDateKey(range.end);

  if (freq === "daily" || freq === "weekly") {
    const step = interval * (freq === "weekly" ? 7 : 1);
    const originDay = dayNumber(origin);
    const minIdx = Math.floor((dayNumber(rangeStart) - originDay) / step) - 1;
    const maxIdx = Math.ceil((dayNumber(rangeEnd) - originDay) / step) + 1;
    return { min: Math.max(0, minIdx), max: Math.max(0, maxIdx) };
  }

  if (freq === "monthly") {
    const originMonths = origin.year * 12 + (origin.month - 1);
    const minIdx = Math.floor((rangeStart.year * 12 + (rangeStart.month - 1) - originMonths) / interval) - 1;
    const maxIdx = Math.ceil((rangeEnd.year * 12 + (rangeEnd.month - 1) - originMonths) / interval) + 1;
    return { min: Math.max(0, minIdx), max: Math.max(0, maxIdx) };
  }

  // yearly
  const minIdx = Math.floor((rangeStart.year - origin.year) / interval) - 1;
  const maxIdx = Math.ceil((rangeEnd.year - origin.year) / interval) + 1;
  return { min: Math.max(0, minIdx), max: Math.max(0, maxIdx) };
}

/**
 * Expands a recurring parent event into its concrete occurrence instances
 * falling within `range` (inclusive calendar dates, read in `timeZone`).
 * Pure function — no DB/UI concerns; see `src/lib/actions/events.ts` and
 * `calendar/page.tsx` for how this is wired into persistence and display.
 *
 * Correctness points:
 * - An occurrence repeats at the same *wall-clock* time in `timeZone` every
 *   cycle, not the same fixed UTC instant: start/end are rebuilt via
 *   `zonedDateTimeToUtcIso` (which re-derives the real UTC offset for every
 *   instant from `Intl`, rather than reusing one offset) from the
 *   occurrence's own calendar date — so e.g. a daily 9am KST event stays
 *   9am KST even across a DST boundary in some other zone.
 * - Monthly/yearly day-of-month clamping: see `occurrenceDateForIndex`.
 * - `exceptionDates` are the *original* would-be occurrence dates
 *   (yyyy-MM-dd) to skip entirely. Both "cancelled" and "modified"
 *   exceptions use this: a modified occurrence is already represented by
 *   its own detached `events` row elsewhere and must not also get a
 *   computed duplicate here.
 */
export function expandRecurringEvent(
  parent: RecurringSourceEvent,
  rule: RecurrenceRule,
  range: DateRange,
  timeZone: string,
  exceptionDates: ReadonlySet<string> = new Set()
): ComputedOccurrence[] {
  const startParts = zonedDateParts(parent.start_at, timeZone);
  const origin: DateParts = { year: startParts.year, month: startParts.month, day: startParts.day };
  const startTimeStr = `${pad2(startParts.hour)}:${pad2(startParts.minute)}:${pad2(startParts.second)}`;

  // How many calendar days the stored end lands after the stored start (0
  // for a same-day event) — reapplied to each occurrence's own start date so
  // a multi-day/overnight recurring event keeps the same span every cycle.
  let dayOffset = 0;
  let endTimeStr: string | undefined;
  if (parent.end_at) {
    const endParts = zonedDateParts(parent.end_at, timeZone);
    dayOffset = dayNumber({ year: endParts.year, month: endParts.month, day: endParts.day }) - dayNumber(origin);
    endTimeStr = `${pad2(endParts.hour)}:${pad2(endParts.minute)}:${pad2(endParts.second)}`;
  }

  const horizonKey = dateKey({ ...origin, year: origin.year + MAX_RECURRENCE_HORIZON_YEARS });
  const cutoffKey = rule.endType === "until" && rule.until && rule.until < horizonKey ? rule.until : horizonKey;

  const { min, max } = estimateIndexBounds(rule.freq, rule.interval, origin, range);
  const occurrences: ComputedOccurrence[] = [];

  for (let index = min; index <= max; index++) {
    if (rule.endType === "count" && rule.count != null && index >= rule.count) break;
    const occurrenceParts = occurrenceDateForIndex(rule.freq, rule.interval, origin, index);
    const key = dateKey(occurrenceParts);
    if (key > cutoffKey) break; // dates are monotonically increasing with index
    if (key < range.start || key > range.end) continue;
    if (exceptionDates.has(key)) continue;

    const startAt = zonedDateTimeToUtcIso(key, parent.all_day ? undefined : startTimeStr, timeZone);
    let endAt: string | null = null;
    if (parent.end_at) {
      const endParts = partsFromDayNumber(dayNumber(occurrenceParts) + dayOffset);
      endAt = zonedDateTimeToUtcIso(dateKey(endParts), parent.all_day ? undefined : endTimeStr, timeZone);
    }

    occurrences.push({
      id: buildOccurrenceId(parent.id, key),
      parentEventId: parent.id,
      occurrenceDate: key,
      index,
      start_at: startAt,
      end_at: endAt,
    });
  }

  return occurrences;
}

/**
 * Default server-side expansion window for rendering the calendar: wide
 * enough to cover month navigation a reasonable distance from "today"
 * without expanding a "never"-ending series indefinitely. Deliberately not
 * tied to the specific month being viewed — this app fetches all
 * non-recurring events unfiltered by date too (see calendar/page.tsx), so
 * this keeps recurring and non-recurring events "equally visible" across
 * the views that merge them (month grid + the unbounded thread/list view).
 */
export function defaultExpansionWindow(todayIso: string, timeZone: string): DateRange {
  const { year, month, day } = zonedDateParts(todayIso, timeZone);
  const clampedDay = (y: number) => Math.min(day, daysInMonth(y, month));
  return {
    start: dateKey({ year: year - 1, month, day: clampedDay(year - 1) }),
    end: dateKey({ year: year + 3, month, day: clampedDay(year + 3) }),
  };
}

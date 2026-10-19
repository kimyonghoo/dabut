import { format } from "date-fns";
import { toZonedDateInputValue } from "@/lib/dates/timezone";
import { isMultiDayEvent, type DaySummaryEvent } from "./day-summary";

export type MultiDaySegment = {
  /** Index into the week-chunks produced by `groupIntoWeeks`. */
  weekIndex: number;
  /** 0 (Sun) - 6 (Sat): first day-of-week column this segment covers in that week. */
  startCol: number;
  /** 0 (Sun) - 6 (Sat): last day-of-week column this segment covers in that week (inclusive). */
  endCol: number;
  /** True when this segment contains the event's real first day — gets a rounded start cap. */
  isEventStart: boolean;
  /** True when this segment contains the event's real last day — gets a rounded end cap. */
  isEventEnd: boolean;
};

function dayKey(day: Date): string {
  return format(day, "yyyy-MM-dd");
}

/** Splits a flat month-grid (a multiple of 7 days, as returned by `getMonthGridDays`) into week-rows. */
export function groupIntoWeeks(gridDays: readonly Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < gridDays.length; i += 7) {
    weeks.push(gridDays.slice(i, i + 7));
  }
  return weeks;
}

/**
 * Computes the per-week bar segments a multi-day event needs to render as a
 * single continuous bar across a month grid laid out week-by-week: since a
 * CSS grid can't visually span a line-wrap, an event that crosses a week
 * boundary is split into one segment per week it touches, each placed via
 * `grid-column: startCol / endCol` (0-indexed, Sun-Sat) within that week's
 * row. Returns an empty array for an event that isn't multi-day in
 * `timeZone` (same start/end calendar day) — callers should render those as
 * ordinary same-cell chips instead.
 *
 * Day-column matching reuses the same "zoned calendar day" primitive as the
 * rest of the day-summary logic (`toZonedDateInputValue`) rather than
 * hand-rolling date math; lexicographic comparison of `yyyy-MM-dd` keys is
 * equivalent to chronological comparison.
 */
export function computeMultiDaySegments(
  gridDays: readonly Date[],
  event: Pick<DaySummaryEvent, "start_at" | "end_at">,
  timeZone: string
): MultiDaySegment[] {
  if (!isMultiDayEvent(event, timeZone)) return [];
  const startKey = toZonedDateInputValue(event.start_at, timeZone);
  const endKey = toZonedDateInputValue(event.end_at as string, timeZone);
  const weeks = groupIntoWeeks(gridDays);
  const segments: MultiDaySegment[] = [];

  weeks.forEach((week, weekIndex) => {
    let startCol = -1;
    let endCol = -1;
    week.forEach((day, col) => {
      const key = dayKey(day);
      if (key >= startKey && key <= endKey) {
        if (startCol === -1) startCol = col;
        endCol = col;
      }
    });
    if (startCol === -1) return;
    segments.push({
      weekIndex,
      startCol,
      endCol,
      isEventStart: dayKey(week[startCol]) === startKey,
      isEventEnd: dayKey(week[endCol]) === endKey,
    });
  });

  return segments;
}

/**
 * Greedily assigns each item (already filtered to a single week) a lane
 * index so overlapping segments (by day-of-week column range) never share a
 * lane — the same "interval scheduling" stacking Google Calendar/Samsung
 * Calendar use for overlapping multi-day events in one week row. Items are
 * processed in start-column order; a lane is reused once its previous
 * occupant has fully ended before the new item's start column.
 */
export function assignLanes<T extends { startCol: number; endCol: number }>(
  items: readonly T[]
): Array<{ item: T; lane: number }> {
  const laneEnds: number[] = [];
  const sorted = [...items].sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
  const result: Array<{ item: T; lane: number }> = [];
  for (const item of sorted) {
    let lane = laneEnds.findIndex((end) => end < item.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endCol);
    } else {
      laneEnds[lane] = item.endCol;
    }
    result.push({ item, lane });
  }
  return result;
}

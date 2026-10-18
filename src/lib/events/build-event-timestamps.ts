import { zonedDateTimeToUtcIso } from "@/lib/dates/timezone";

export type TimeMode = "allDay" | "timeRange" | "dateRange";

export function buildEventTimestamps(input: {
  mode: TimeMode;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  /** The acting user's configured timezone; naive date/time inputs are interpreted as wall-clock values here. */
  timeZone: string;
}): { allDay: boolean; startAt: string; endAt: string | null } | { error: string } {
  const { mode, startDate, startTime, endDate, endTime, timeZone } = input;

  if (mode === "allDay") {
    const start = zonedDateTimeToUtcIso(startDate, undefined, timeZone);
    return { allDay: true, startAt: start, endAt: null };
  }

  if (mode === "timeRange") {
    const start = zonedDateTimeToUtcIso(startDate, startTime, timeZone);
    const end = zonedDateTimeToUtcIso(startDate, endTime, timeZone);
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      return { error: "End time must be after start time" };
    }
    return { allDay: false, startAt: start, endAt: end };
  }

  const start = zonedDateTimeToUtcIso(startDate, undefined, timeZone);
  const end = zonedDateTimeToUtcIso(endDate!, undefined, timeZone);
  if (new Date(end).getTime() < new Date(start).getTime()) {
    return { error: "End date must be on or after start date" };
  }
  return { allDay: true, startAt: start, endAt: end };
}

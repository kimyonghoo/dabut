export type TimeMode = "allDay" | "timeRange" | "dateRange";

export function buildEventTimestamps(input: {
  mode: TimeMode;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}): { allDay: boolean; startAt: string; endAt: string | null } | { error: string } {
  const { mode, startDate, startTime, endDate, endTime } = input;

  if (mode === "allDay") {
    const start = new Date(`${startDate}T00:00:00`);
    return { allDay: true, startAt: start.toISOString(), endAt: null };
  }

  if (mode === "timeRange") {
    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${startDate}T${endTime}:00`);
    if (end.getTime() <= start.getTime()) {
      return { error: "End time must be after start time" };
    }
    return { allDay: false, startAt: start.toISOString(), endAt: end.toISOString() };
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (end.getTime() < start.getTime()) {
    return { error: "End date must be on or after start date" };
  }
  return { allDay: true, startAt: start.toISOString(), endAt: end.toISOString() };
}

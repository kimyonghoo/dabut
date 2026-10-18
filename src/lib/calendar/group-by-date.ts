import { toZonedDateInputValue } from "@/lib/dates/timezone";

export function groupEventsByDate<T extends { start_at: string }>(
  events: T[],
  timeZone: string
): Array<{ date: string; events: T[] }> {
  const byDate = new Map<string, T[]>();

  for (const event of events) {
    const key = toZonedDateInputValue(event.start_at, timeZone);
    const existing = byDate.get(key);
    if (existing) {
      existing.push(event);
    } else {
      byDate.set(key, [event]);
    }
  }

  const dates = [...byDate.keys()].sort();
  return dates.map((date) => ({
    date,
    events: byDate.get(date)!.sort((a, b) => a.start_at.localeCompare(b.start_at)),
  }));
}

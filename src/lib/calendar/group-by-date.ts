import { format, parseISO } from "date-fns";

export function groupEventsByDate<T extends { start_at: string }>(
  events: T[]
): Array<{ date: string; events: T[] }> {
  const byDate = new Map<string, T[]>();

  for (const event of events) {
    const key = format(parseISO(event.start_at), "yyyy-MM-dd");
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

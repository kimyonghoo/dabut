import { useTranslations } from "next-intl";
import { CalendarHeart } from "lucide-react";
import { expandEventsByDay, type DayEntry } from "@/lib/calendar/expand-multi-day";
import { toZonedTimeInputValue } from "@/lib/dates/timezone";
import { Link } from "@/i18n/navigation";
import type { Database } from "@/types/database.types";
import { ThreadList, type ThreadGroup } from "./thread-list";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CategorizedEvent = EventRow & { category: "mine" | "partner" | "shared" };

function timeLabel(entry: DayEntry<EventRow>, allDay: string, timeZone: string): string {
  const { event, dayPart } = entry;
  if (event.all_day) return allDay;
  if (dayPart === "middle") return allDay;
  const start = toZonedTimeInputValue(event.start_at, timeZone);
  if (dayPart === "first") return `${start}~`;
  if (dayPart === "last") return `~${entry.endsAtMidnight ? "24:00" : toZonedTimeInputValue(event.end_at ?? event.start_at, timeZone)}`;
  if (!event.end_at) return start;
  return `${start}–${toZonedTimeInputValue(event.end_at, timeZone)}`;
}

function groupEntriesByDate(entries: DayEntry<CategorizedEvent>[], monthKey?: string) {
  const byDate = new Map<string, DayEntry<CategorizedEvent>[]>();
  for (const entry of entries) {
    if (monthKey && !entry.date.startsWith(monthKey)) continue;
    const list = byDate.get(entry.date);
    if (list) list.push(entry);
    else byDate.set(entry.date, [entry]);
  }
  return [...byDate.keys()].sort().map((date) => ({
    date,
    entries: byDate.get(date)!.sort((x, y) => {
      // Continuing multi-day cards (middle/last) have no start time today: list them first.
      const rank = (e: DayEntry<CategorizedEvent>) => (e.dayPart === "middle" || e.dayPart === "last" ? 0 : 1);
      return rank(x) - rank(y) || x.event.start_at.localeCompare(y.event.start_at);
    }),
  }));
}

/**
 * Groups and formats on the server (same as before, so SSR and hydration
 * agree); the client ThreadList adds swipe-to-delete and relative date labels.
 */
export function ThreadView({
  events,
  currentUserId,
  serverTodayKey,
  timeZone,
  partnerName,
  isCurrentMonth,
  monthKey,
}: {
  events: CategorizedEvent[];
  currentUserId: string;
  serverTodayKey: string;
  /** The viewing user's configured timezone, for day grouping and HH:mm labels. */
  timeZone: string;
  partnerName?: string | null;
  /** Whether the selected month is the real current month — gates the synthetic "오늘 일정없음" placeholder. */
  isCurrentMonth: boolean;
  /** Optional "yyyy-MM": drops day groups outside this month (events overlapping the month edges). */
  monthKey?: string;
}) {
  const t = useTranslations("calendar");
  const groups: ThreadGroup[] = groupEntriesByDate(expandEventsByDay(events, timeZone), monthKey).map((group) => ({
    date: group.date,
    events: group.entries.map((entry) => ({
      id: entry.event.id,
      ownerId: entry.event.owner_id,
      title: entry.event.title,
      location: entry.event.location,
      companions: entry.event.companions,
      category: entry.event.category,
      timeText: timeLabel(entry, t("allDay"), timeZone),
    })),
  }));

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-6 py-12 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
          <CalendarHeart aria-hidden className="size-7" strokeWidth={1.75} />
        </span>
        <p className="font-semibold text-ink">{t("emptyTitle")}</p>
        <p className="text-sm text-ink-muted">{t("emptyHint")}</p>
        <Link
          href="/calendar/new"
          className="mt-2 inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong active:scale-[0.97]"
        >
          {t("newEvent")}
        </Link>
      </div>
    );
  }

  return (
    <ThreadList
      groups={groups}
      currentUserId={currentUserId}
      serverTodayKey={serverTodayKey}
      partnerName={partnerName}
      isCurrentMonth={isCurrentMonth}
    />
  );
}

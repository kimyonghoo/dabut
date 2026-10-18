import { useTranslations } from "next-intl";
import { CalendarHeart } from "lucide-react";
import { format, parseISO } from "date-fns";
import { groupEventsByDate } from "@/lib/calendar/group-by-date";
import { Link } from "@/i18n/navigation";
import type { Database } from "@/types/database.types";
import { ThreadList, type ThreadGroup } from "./thread-list";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CategorizedEvent = EventRow & { category: "mine" | "partner" | "shared" };

function timeLabel(event: EventRow, allDay: string): string {
  if (event.all_day) return allDay;
  const start = format(parseISO(event.start_at), "HH:mm");
  if (!event.end_at) return start;
  return `${start}–${format(parseISO(event.end_at), "HH:mm")}`;
}

/**
 * Groups and formats on the server (same as before, so SSR and hydration
 * agree); the client ThreadList adds swipe-to-delete and relative date labels.
 */
export function ThreadView({
  events,
  currentUserId,
  serverTodayKey,
}: {
  events: CategorizedEvent[];
  currentUserId: string;
  serverTodayKey: string;
}) {
  const t = useTranslations("calendar");
  const groups: ThreadGroup[] = groupEventsByDate(events).map((group) => ({
    date: group.date,
    events: group.events.map((event) => ({
      id: event.id,
      ownerId: event.owner_id,
      title: event.title,
      location: event.location,
      companions: event.companions,
      category: event.category,
      timeText: timeLabel(event, t("allDay")),
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

  return <ThreadList groups={groups} currentUserId={currentUserId} serverTodayKey={serverTodayKey} />;
}

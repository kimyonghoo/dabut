import { useLocale, useTranslations } from "next-intl";
import { CalendarHeart, Clock, MapPin, Users } from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { groupEventsByDate } from "@/lib/calendar/group-by-date";
import { Link } from "@/i18n/navigation";
import type { Database } from "@/types/database.types";
import { BADGE_CLASSNAME, CATEGORY_KEY, DOT_CLASSNAME } from "./category-style";
import { getDateFnsLocale } from "./date-locale";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CategorizedEvent = EventRow & { category: "mine" | "partner" | "shared" };

function datePattern(locale: string): string {
  if (locale === "en") return "EEE, MMM d";
  if (locale === "zh") return "M月d日 EEEE";
  return "M월 d일 EEEE";
}

function timeLabel(event: EventRow, allDay: string): string {
  if (event.all_day) return allDay;
  const start = format(parseISO(event.start_at), "HH:mm");
  if (!event.end_at) return start;
  return `${start}–${format(parseISO(event.end_at), "HH:mm")}`;
}

export function ThreadView({ events }: { events: CategorizedEvent[] }) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const dfLocale = getDateFnsLocale(locale);
  const grouped = groupEventsByDate(events);

  if (grouped.length === 0) {
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
    <div className="flex flex-col gap-4">
      {grouped.map((group) => {
        const date = parseISO(group.date);
        const today = isToday(date);
        return (
          <section key={group.date} className="relative">
            <h3 className="sticky top-0 z-10 -mx-1 mb-2 bg-bg/90 px-1 py-1.5 backdrop-blur">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  today ? "bg-brand text-white" : "bg-surface-2 text-ink"
                }`}
              >
                {format(date, datePattern(locale), { locale: dfLocale })}
              </span>
            </h3>
            <ul className="ml-3 flex flex-col gap-2 border-l-2 border-dashed border-line pl-4">
              {group.events.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[1.4rem] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-bg ${DOT_CLASSNAME[event.category]}`}
                  />
                  <Link
                    href={`/calendar/${event.id}/edit`}
                    title={t(CATEGORY_KEY[event.category])}
                    className="block rounded-2xl border border-line bg-surface p-3 shadow-[0_2px_10px_rgba(59,47,42,0.05)] transition hover:border-brand/40 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-semibold text-ink">{event.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_CLASSNAME[event.category]}`}
                      >
                        {t(CATEGORY_KEY[event.category])}
                      </span>
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
                      <Clock aria-hidden className="size-3.5 shrink-0" />
                      {timeLabel(event, t("allDay"))}
                    </p>
                    {event.location && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
                        <MapPin aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </p>
                    )}
                    {event.companions && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
                        <Users aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate">{event.companions}</span>
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

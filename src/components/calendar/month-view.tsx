import { useLocale, useTranslations } from "next-intl";
import { format, isSameDay, isSameMonth } from "date-fns";
import { getMonthGridDays } from "@/lib/calendar/month-grid";
import { isDayWithinEvent } from "@/lib/calendar/day-summary";
import { Card } from "@/components/ui/card";
import type { Database } from "@/types/database.types";
import { CATEGORY_KEY, CHIP_CLASSNAME, DOT_CLASSNAME } from "./category-style";
import { getDateFnsLocale } from "./date-locale";
import { DayCellButton, DaySummaryProvider } from "./day-summary-sheet";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CategorizedEvent = EventRow & { category: "mine" | "partner" | "shared" };

const MAX_CHIPS = 2;

function dateKey(day: Date): string {
  return format(day, "yyyy-MM-dd");
}

function weekdayColor(dayOfWeek: number): string {
  if (dayOfWeek === 0) return "text-expense";
  if (dayOfWeek === 6) return "text-partner";
  return "text-ink-muted";
}

export function MonthView({
  month,
  events,
  currentUserId,
  partnerName,
  timeZone,
}: {
  month: Date;
  events: CategorizedEvent[];
  currentUserId: string;
  partnerName?: string | null;
  /** The viewing user's configured timezone — decides which calendar day each event's instant falls on. */
  timeZone: string;
}) {
  const t = useTranslations("calendar");
  const tSummary = useTranslations("daySummary");
  const locale = useLocale();
  const dfLocale = getDateFnsLocale(locale);
  const days = getMonthGridDays(month);
  const today = new Date();
  const weekdays = days.slice(0, 7);

  const summaryEvents = events.map(({ id, owner_id, title, all_day, start_at, end_at, visibility }) => ({
    id,
    owner_id,
    title,
    all_day,
    start_at,
    end_at,
    visibility,
  }));

  return (
    <DaySummaryProvider events={summaryEvents} currentUserId={currentUserId} partnerName={partnerName} timeZone={timeZone}>
    <Card className="!p-2 sm:!p-3">
      <div className="grid grid-cols-7 pb-1.5 text-center text-[11px] font-semibold">
        {weekdays.map((day) => (
          <div key={day.getDay()} className={weekdayColor(day.getDay())}>
            {format(day, locale === "en" ? "EEE" : "EEEEE", { locale: dfLocale })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-line">
        {days.map((day) => {
          const dayEvents = events.filter((event) => isDayWithinEvent(day, event, timeZone));
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const visible = dayEvents.slice(0, MAX_CHIPS);
          const hidden = dayEvents.length - visible.length;
          return (
            <DayCellButton
              key={day.toISOString()}
              dateKey={dateKey(day)}
              label={tSummary("openDay", {
                date: format(day, "PPP", { locale: dfLocale }),
                count: dayEvents.length,
              })}
              className={`flex min-h-[4.75rem] min-w-0 flex-col gap-0.5 p-0.5 ${
                inMonth ? "bg-surface" : "bg-surface-2/60 opacity-45"
              }`}
            >
              <span
                aria-current={isToday ? "date" : undefined}
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? "bg-brand font-bold text-white shadow-sm"
                    : `font-medium ${day.getDay() === 0 ? "text-expense" : day.getDay() === 6 ? "text-partner" : "text-ink"}`
                }`}
              >
                {day.getDate()}
              </span>
              <ul className="flex min-w-0 flex-col gap-0.5">
                {visible.map((event) => (
                  <li key={event.id} className="min-w-0" title={t(CATEGORY_KEY[event.category])}>
                    <span
                      className={`flex min-w-0 items-center gap-0.5 rounded-md px-1 py-px text-[10px] font-medium leading-tight ${CHIP_CLASSNAME[event.category]}`}
                    >
                      {event.category === "partner" && (
                        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSNAME.partner}`} />
                      )}
                      <span className="truncate">{event.title}</span>
                    </span>
                  </li>
                ))}
                {hidden > 0 && (
                  <li className="px-1 text-[10px] font-semibold text-ink-muted">+{hidden}</li>
                )}
              </ul>
            </DayCellButton>
          );
        })}
      </div>
    </Card>
    </DaySummaryProvider>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useTransition } from "react";
import { addMonths, format, isSameDay, isSameMonth } from "date-fns";
import { motion, type PanInfo } from "framer-motion";
import { getMonthGridDays } from "@/lib/calendar/month-grid";
import { isDayWithinEvent, isMultiDayEvent } from "@/lib/calendar/day-summary";
import { assignLanes, computeMultiDaySegments, groupIntoWeeks, type MultiDaySegment } from "@/lib/calendar/multi-day-bars";
import { Card } from "@/components/ui/card";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import type { Database } from "@/types/database.types";
import { CATEGORY_KEY, CHIP_CLASSNAME, DOT_CLASSNAME } from "./category-style";
import { getDateFnsLocale, monthHref } from "./date-locale";
import { DayCellButton, DaySummaryProvider } from "./day-summary-sheet";

// A swipe shorter/slower than this is treated as a normal tap or vertical
// scroll, not an intentional month-change gesture — keeps accidental small
// drags and plain scrolling from firing a navigation.
const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 500;

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CategorizedEvent = EventRow & { category: "mine" | "partner" | "shared" };
type EventSegment = MultiDaySegment & { event: CategorizedEvent };

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
  holidays,
}: {
  month: Date;
  events: CategorizedEvent[];
  currentUserId: string;
  partnerName?: string | null;
  /** The viewing user's configured timezone — decides which calendar day each event's instant falls on. */
  timeZone: string;
  /**
   * "yyyy-MM-dd" -> holiday name entries, computed server-side (see
   * lib/calendar/holidays.ts) and passed as plain tuples rather than a Map
   * so this stays a trivially serializable RSC prop — `date-holidays`'s ~2MB
   * rule data must never end up in the client bundle.
   */
  holidays?: [string, string][];
}) {
  const t = useTranslations("calendar");
  const tSummary = useTranslations("daySummary");
  const locale = useLocale();
  const dfLocale = getDateFnsLocale(locale);
  const router = useProgressRouter();
  const [, startTransition] = useTransition();
  const days = getMonthGridDays(month);
  const weeks = groupIntoWeeks(days);
  const today = new Date();
  const weekdays = days.slice(0, 7);

  const holidayMap = useMemo(() => new Map(holidays), [holidays]);

  // Left swipe -> next month, right swipe -> previous month; reuses the
  // exact same `/calendar?month=yyyy-MM` href the header's prev/next arrow
  // links already navigate to (see date-locale.ts's monthHref), so the two
  // navigation paths can't drift apart. A small/slow drag (ordinary vertical
  // scroll, or an accidental nudge) clears neither the distance nor the
  // velocity threshold and is ignored — only a deliberate horizontal swipe
  // changes the month.
  //
  // The push is wrapped in startTransition (same pattern as
  // use-locale-switcher.ts and month-nav-arrows.tsx) so React keeps this
  // month's grid mounted and visible — for MonthSlide to animate out —
  // instead of the route's loading.tsx fallback blanking the screen while
  // the new month streams in.
  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const { x } = info.offset;
    const { x: vx } = info.velocity;
    if (x <= -SWIPE_DISTANCE_THRESHOLD || vx <= -SWIPE_VELOCITY_THRESHOLD) {
      const href = monthHref(addMonths(month, 1));
      startTransition(() => router.push(href));
    } else if (x >= SWIPE_DISTANCE_THRESHOLD || vx >= SWIPE_VELOCITY_THRESHOLD) {
      const href = monthHref(addMonths(month, -1));
      startTransition(() => router.push(href));
    }
  }

  const summaryEvents = events.map(({ id, owner_id, title, all_day, start_at, end_at, visibility }) => ({
    id,
    owner_id,
    title,
    all_day,
    start_at,
    end_at,
    visibility,
  }));

  // Events spanning different calendar days (in `timeZone`) render as a
  // single continuous bar in a per-week "multi-day lane" instead of a chip
  // repeated in every day cell they touch; same-day events keep the
  // existing chip rendering unchanged.
  const multiDayEvents = events.filter((event) => isMultiDayEvent(event, timeZone));
  const singleDayEvents = events.filter((event) => !isMultiDayEvent(event, timeZone));

  const lanesByWeek = weeks.map((_, weekIndex) => {
    const segments: EventSegment[] = multiDayEvents.flatMap((event) =>
      computeMultiDaySegments(days, event, timeZone)
        .filter((segment) => segment.weekIndex === weekIndex)
        .map((segment) => ({ ...segment, event }))
    );
    return assignLanes(segments);
  });

  return (
    <DaySummaryProvider
      events={summaryEvents}
      currentUserId={currentUserId}
      partnerName={partnerName}
      timeZone={timeZone}
      holidays={holidayMap}
    >
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      dragDirectionLock
      onDragEnd={handleDragEnd}
      className="touch-pan-y"
    >
    <Card className="!p-2 sm:!p-3">
      <div className="grid grid-cols-7 pb-1.5 text-center text-[11px] font-semibold">
        {weekdays.map((day) => (
          <div key={day.getDay()} className={weekdayColor(day.getDay())}>
            {format(day, locale === "en" ? "EEE" : "EEEEE", { locale: dfLocale })}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-xl bg-line">
        {weeks.map((weekDays, weekIndex) => {
          const laned = lanesByWeek[weekIndex];
          const laneCount = laned.reduce((max, { lane }) => Math.max(max, lane + 1), 0);
          return (
            <div key={weekDays[0].toISOString()} className="flex flex-col gap-px">
              {laneCount > 0 && (
                <div
                  className="grid grid-cols-7 gap-x-px gap-y-0.5 bg-surface px-0.5 pt-0.5"
                  style={{ gridAutoRows: "1.1rem" }}
                >
                  {laned.map(({ item, lane }) => (
                    <span
                      key={item.event.id}
                      title={item.event.title}
                      style={{
                        gridColumn: `${item.startCol + 1} / ${item.endCol + 2}`,
                        gridRow: lane + 1,
                      }}
                      className={`flex min-w-0 items-center truncate px-1.5 text-[10px] font-medium leading-[1.1rem] ${
                        CHIP_CLASSNAME[item.event.category]
                      } ${item.isEventStart ? "rounded-l-md" : ""} ${item.isEventEnd ? "rounded-r-md" : ""}`}
                    >
                      {item.isEventStart ? item.event.title : ""}
                    </span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-7 gap-px bg-line">
                {weekDays.map((day) => {
                  const touching = events.filter((event) => isDayWithinEvent(day, event, timeZone));
                  const dayEvents = singleDayEvents.filter((event) => isDayWithinEvent(day, event, timeZone));
                  const inMonth = isSameMonth(day, month);
                  const isToday = isSameDay(day, today);
                  const holidayName = holidayMap.get(dateKey(day));
                  const visible = dayEvents.slice(0, MAX_CHIPS);
                  const hidden = dayEvents.length - visible.length;
                  return (
                    <DayCellButton
                      key={day.toISOString()}
                      dateKey={dateKey(day)}
                      label={tSummary("openDay", {
                        date: format(day, "PPP", { locale: dfLocale }),
                        count: touching.length,
                      })}
                      className={`flex min-h-[6.5rem] min-w-0 flex-col gap-0.5 p-0.5 ${
                        inMonth ? "bg-surface" : "bg-surface-2/60 opacity-45"
                      } ${isToday ? "today-cell-indicator" : ""}`}
                    >
                      <span
                        aria-current={isToday ? "date" : undefined}
                        title={holidayName}
                        className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          isToday
                            ? "bg-brand font-bold text-white shadow-sm"
                            : `font-medium ${holidayName || day.getDay() === 0 ? "text-expense" : day.getDay() === 6 ? "text-partner" : "text-ink"}`
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      <ul className="flex min-w-0 flex-col gap-0.5">
                        {visible.map((event) => (
                          <li key={event.id} className="min-w-0" title={t(CATEGORY_KEY[event.category])}>
                            <span
                              className={`flex min-w-0 items-start gap-0.5 rounded-md px-1 py-px text-[10px] font-medium leading-tight ${CHIP_CLASSNAME[event.category]}`}
                            >
                              {event.category === "partner" && (
                                <span aria-hidden className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSNAME.partner}`} />
                              )}
                              <span className="line-clamp-2 min-w-0 break-words">{event.title}</span>
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
            </div>
          );
        })}
      </div>
    </Card>
    </motion.div>
    </DaySummaryProvider>
  );
}

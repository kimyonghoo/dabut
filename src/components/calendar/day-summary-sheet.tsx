"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { CalendarPlus, ChevronRight, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";
import { categorizeEvent } from "@/lib/calendar/categorize-event";
import { isMultiDayEvent, splitDayEvents, type DaySummaryEvent } from "@/lib/calendar/day-summary";
import { eventEditHref } from "@/lib/calendar/event-link";
import { formatInTimeZone, toZonedDateInputValue } from "@/lib/dates/timezone";
import { DOT_CLASSNAME } from "./category-style";
import { getDateFnsLocale } from "./date-locale";

export type DaySummaryItem = DaySummaryEvent & { visibility: string };

type OpenDay = (dateKey: string) => void;

const DaySummaryContext = createContext<OpenDay | null>(null);

function parseDateKey(key: string): Date | null {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dayTitlePattern(locale: string): string {
  if (locale === "en") return "EEEE, MMMM d";
  if (locale === "zh") return "M月d日 EEEE";
  return "M월 d일 EEEE";
}

/** Compact "10월 3일" / "Oct 3" style pattern, used to show a multi-day event's full date range. */
function shortDatePattern(locale: string): string {
  if (locale === "en") return "MMM d";
  if (locale === "zh") return "M月d日";
  return "M월 d일";
}

/**
 * Holds the "which day is open" state for the month grid and renders the
 * bottom sheet. Day cells call `useOpenDaySummary()` to open it.
 */
export function DaySummaryProvider({
  events,
  currentUserId,
  partnerName,
  timeZone,
  holidays,
  children,
}: {
  events: DaySummaryItem[];
  currentUserId: string;
  partnerName?: string | null;
  /**
   * The viewing user's configured timezone, threaded straight from the
   * server-rendered page (same value the month grid uses to decide which
   * calendar day each event falls on). Deliberately NOT read from
   * `useTimezone()`'s context here: that context is seeded once when the
   * `(app)` layout mounts and does not re-sync on client-side navigation, so
   * it can silently drift from the fresh per-request value this page just
   * fetched — which would make the grid and this sheet disagree on which
   * day a near-midnight event belongs to.
   */
  timeZone: string;
  /** "yyyy-MM-dd" -> holiday name, for the viewer's own timezone/country (see lib/calendar/holidays.ts). */
  holidays?: Map<string, string>;
  children: ReactNode;
}) {
  const [dateKey, setDateKey] = useState<string | null>(null);
  const open = useCallback<OpenDay>((key) => setDateKey(key), []);
  const close = useCallback(() => setDateKey(null), []);

  return (
    <DaySummaryContext.Provider value={open}>
      {children}
      <DaySummarySheet
        dateKey={dateKey}
        onClose={close}
        events={events}
        currentUserId={currentUserId}
        partnerName={partnerName}
        timeZone={timeZone}
        holidayName={dateKey ? holidays?.get(dateKey) : undefined}
      />
    </DaySummaryContext.Provider>
  );
}

/**
 * Month-grid cell that opens the day summary. The cell content stays a plain
 * <div>; a transparent full-cell <button> sits on top so the markup stays valid
 * (no lists inside a button) while the whole cell is tappable.
 */
export function DayCellButton({
  dateKey,
  label,
  className,
  children,
}: {
  dateKey: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const open = useContext(DaySummaryContext);
  return (
    <div className={`relative ${className ?? ""}`}>
      {children}
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => open?.(dateKey)}
        className="absolute inset-0 z-[1] cursor-pointer transition hover:bg-brand/5 active:bg-brand/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      />
    </div>
  );
}

function DaySummarySheet({
  dateKey,
  onClose,
  events,
  currentUserId,
  partnerName,
  timeZone,
  holidayName,
}: {
  dateKey: string | null;
  onClose: () => void;
  events: DaySummaryItem[];
  currentUserId: string;
  partnerName?: string | null;
  timeZone: string;
  holidayName?: string;
}) {
  const t = useTranslations("daySummary");
  const locale = useLocale();
  const dfLocale = getDateFnsLocale(locale);
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  // Drag-to-dismiss starts only from the handle/header so the list can scroll.
  const dragControls = useDragControls();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const day = useMemo(() => (dateKey ? parseDateKey(dateKey) : null), [dateKey]);
  const sections = useMemo(
    () => (day ? splitDayEvents(events, day, currentUserId, timeZone) : { mine: [], partner: [], shared: [] }),
    [day, events, currentUserId, timeZone]
  );

  // Escape to close, lock page scroll, move focus into the sheet.
  useEffect(() => {
    if (!dateKey) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [dateKey, onClose]);

  function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > 100 || info.velocity.y > 600) onClose();
  }

  function timeLabel(event: DaySummaryItem): string {
    if (event.all_day) return t("allDay");
    const start = formatInTimeZone(event.start_at, timeZone, { timeStyle: "short" }, locale);
    if (!event.end_at) return start;
    return `${start}–${formatInTimeZone(event.end_at, timeZone, { timeStyle: "short" }, locale)}`;
  }

  // Full "10월 22일 오후 8:00 ~ 10월 25일 오전 8:00" range (all-day: dates only)
  // for an event that spans different calendar days in `timeZone`.
  function rangeLabel(event: DaySummaryItem): string {
    if (event.all_day || !event.end_at) return dateRangeLabel(event);
    const opts: Intl.DateTimeFormatOptions = {
      month: locale === "en" ? "short" : "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    const start = formatInTimeZone(event.start_at, timeZone, opts, locale);
    const end = formatInTimeZone(event.end_at, timeZone, opts, locale);
    return `${start} ~ ${end}`;
  }

  function dateRangeLabel(event: DaySummaryItem): string {
    const startDay = parseDateKey(toZonedDateInputValue(event.start_at, timeZone));
    const endDay = event.end_at ? parseDateKey(toZonedDateInputValue(event.end_at, timeZone)) : startDay;
    if (!startDay || !endDay) return "";
    const pattern = shortDatePattern(locale);
    return `${format(startDay, pattern, { locale: dfLocale })} ~ ${format(endDay, pattern, { locale: dfLocale })}`;
  }

  function tr(key: string, fallback: string, values?: Record<string, string>): string {
    return t.has(key as never) ? t(key as never, values as never) : fallback;
  }

  function renderSection(title: string, items: DaySummaryItem[], emptyText: string) {
    return (
      <section className="flex flex-col gap-1.5">
        <h3 className="px-1 text-xs font-semibold text-ink-muted">
          {title}
          <span className="ml-1 text-ink-muted/70">{items.length}</span>
        </h3>
        {items.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((event) => {
              const category = categorizeEvent(
                { owner_id: event.owner_id, visibility: event.visibility as "personal" | "shared" },
                currentUserId
              );
              const multiDay = isMultiDayEvent(event, timeZone);
              return (
                <li key={event.id}>
                  <Link
                    href={eventEditHref(event.id)}
                    onClick={onClose}
                    className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5 transition hover:bg-surface-2 active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASSNAME[category]}`} />
                      {multiDay ? (
                        <span className="min-w-0 flex-1 text-xs font-medium tabular-nums text-ink-muted">
                          {rangeLabel(event)}
                        </span>
                      ) : (
                        <span className="w-28 shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-ink-muted">
                          {timeLabel(event)}
                        </span>
                      )}
                      {!multiDay && (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{event.title}</span>
                      )}
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted/60" />
                    </span>
                    {multiDay && (
                      <span className="min-w-0 truncate pl-[18px] text-sm font-medium text-ink">{event.title}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {dateKey && day && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-summary-title"
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
            drag={reduceMotion ? false : "y"}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="relative flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-[var(--radius-card)] border border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-8px_30px_rgba(59,47,42,0.18)] outline-none sm:rounded-[var(--radius-card)] sm:pb-4"
          >
            <div
              className="shrink-0 touch-none"
              onPointerDown={(e) => {
                if (!reduceMotion) dragControls.start(e);
              }}
            >
            <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
            <header className="flex items-center justify-between gap-2 px-5 pb-2 pt-3">
              <h2 id="day-summary-title" className="flex items-center gap-2 text-lg font-bold text-ink">
                {format(day, dayTitlePattern(locale), { locale: dfLocale })}
                {holidayName && (
                  <span className="rounded-full bg-expense/10 px-2 py-0.5 text-xs font-semibold text-expense">
                    {holidayName}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2"
              >
                <X aria-hidden className="size-5" />
              </button>
            </header>
            </div>
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-3">
              {renderSection(t("mine"), sections.mine, t("mineEmpty"))}
              {renderSection(
                partnerName ? t("partnerNamed", { name: partnerName }) : t("partner"),
                sections.partner,
                t("partnerEmpty")
              )}
              {sections.shared.length > 0 &&
                renderSection(
                  partnerName
                    ? tr("sharedNamed", `같이 하는 일정 (나, ${partnerName})`, { name: partnerName })
                    : tr("shared", "같이 하는 일정 (나, 상대방)"),
                  sections.shared,
                  tr("sharedEmpty", "같이 하는 일정이 없어요")
                )}
            </div>
            <div className="px-4 pt-1">
              <Link
                href={{ pathname: "/calendar/new", query: { date: dateKey } }}
                onClick={onClose}
                className={buttonClass("primary", "w-full py-3")}
              >
                <CalendarPlus aria-hidden className="size-4" />
                {t("addEvent")}
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

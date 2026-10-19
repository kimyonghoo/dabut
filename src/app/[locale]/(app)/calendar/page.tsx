import { getLocale, getTranslations } from "next-intl/server";
import { addMonths, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { categorizeEvent } from "@/lib/calendar/categorize-event";
import { expandEventsForDisplay } from "@/lib/calendar/expand-events-for-display";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ViewToggle } from "@/components/calendar/view-toggle";
import { MonthView } from "@/components/calendar/month-view";
import { ThreadView } from "@/components/calendar/thread-view";
import { CategoryLegend } from "@/components/calendar/category-legend";
import { getDateFnsLocale, monthTitlePattern, parseMonthParam } from "@/components/calendar/date-locale";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { resolvePartnerName } from "@/lib/calendar/partner-name";
import { toDateKey } from "@/lib/dates/relative-day";
import { DEFAULT_TIMEZONE } from "@/lib/dates/timezone";
import { TelegramOnboardingBanner } from "@/components/settings/telegram-onboarding-banner";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const { view, month: monthParam } = await searchParams;
  const t = await getTranslations("calendar");
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // AppLayout already redirects unauthenticated visits to /login, but its
  // getUser() call and this one are independent requests to Supabase Auth;
  // fail safe here too instead of crashing on user!.id if one transiently
  // returns no session.
  if (!user) return redirect({ href: "/login", locale });
  const { data: events } = await supabase.from("events").select("*");
  const partnerName = await resolvePartnerName(supabase, user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("telegram_chat_id, timezone")
    .eq("id", user.id)
    .maybeSingle();
  const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;

  // Recurring parents are expanded into their visible-range computed
  // occurrences and merged with the plain/standalone rows (which already
  // include any detached exceptions) before anything downstream sees them —
  // every display component below keeps working with a plain EventRow[],
  // unaware a given row might be a computed occurrence. See
  // src/lib/calendar/expand-events-for-display.ts.
  const displayEvents = await expandEventsForDisplay(supabase, events ?? [], timeZone);

  const categorized = displayEvents.map((event) => ({
    ...event,
    // visibility is a text check constraint in the DB, not a real Postgres
    // enum, so the generated type is `string`; the constraint guarantees
    // only these two values.
    category: categorizeEvent(
      { owner_id: event.owner_id, visibility: event.visibility as "personal" | "shared" },
      user.id
    ),
  }));

  const month = parseMonthParam(monthParam);
  const isThread = view === "thread";
  const monthTitle = format(month, monthTitlePattern(locale), { locale: getDateFnsLocale(locale) });
  const monthHref = (date: Date) => ({
    pathname: "/calendar" as const,
    query: { month: format(date, "yyyy-MM") },
  });
  const navClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-full text-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink active:scale-90";

  return (
    <main className="flex flex-col gap-4 pb-6">
      {profile && !profile.telegram_chat_id && <TelegramOnboardingBanner />}
      <RealtimeRefresh table="events" />
      {/* A single-occurrence cancel/detach (이 일정만) only writes
          event_exceptions, not events — the other side needs this too to
          live-refresh when a recurring occurrence changes. */}
      <RealtimeRefresh table="event_exceptions" />
      <PageHeader
        title={
          isThread ? (
            t("threadView")
          ) : (
            <span className="inline-flex items-center gap-1">
              <Link href={monthHref(addMonths(month, -1))} aria-label={t("prevMonth")} className={navClass}>
                <ChevronLeft aria-hidden className="size-5" />
              </Link>
              <span>{monthTitle}</span>
              <Link href={monthHref(addMonths(month, 1))} aria-label={t("nextMonth")} className={navClass}>
                <ChevronRight aria-hidden className="size-5" />
              </Link>
            </span>
          )
        }
        action={
          <Link href="/calendar/new" className={buttonClass("primary", "shrink-0 !px-3.5 !py-2")}>
            {t("newEvent")}
          </Link>
        }
      />
      <div className="flex justify-center">
        <ViewToggle />
      </div>
      {isThread ? (
        <ThreadView
          events={categorized}
          currentUserId={user.id}
          serverTodayKey={toDateKey(new Date())}
          timeZone={timeZone}
          partnerName={partnerName}
        />
      ) : (
        <>
          <MonthView
            month={month}
            events={categorized}
            currentUserId={user.id}
            partnerName={partnerName}
            timeZone={timeZone}
          />
          <CategoryLegend />
        </>
      )}
    </main>
  );
}

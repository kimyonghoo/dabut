import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { categorizeEvent } from "@/lib/calendar/categorize-event";
import { expandEventsForDisplay } from "@/lib/calendar/expand-events-for-display";
import { Link, redirect } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ViewToggle } from "@/components/calendar/view-toggle";
import { MonthView } from "@/components/calendar/month-view";
import { MonthSlide } from "@/components/calendar/month-slide";
import { MonthNavArrows } from "@/components/calendar/month-nav-arrows";
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
  // These three only depend on `user.id`/the already-authenticated
  // `supabase` client, not on each other — running them as a single
  // Promise.all instead of three sequential awaits turns three round trips
  // (plus resolvePartnerName's own two internal round trips) into one
  // batch, which is most of where the previous multi-second month-change
  // delay actually came from (the RSC-navigation blank flash on top of that
  // is a separate issue, fixed by startTransition — see MonthSlide).
  const [{ data: events }, partnerName, { data: profile }] = await Promise.all([
    supabase.from("events").select("*"),
    resolvePartnerName(supabase, user.id),
    supabase.from("profiles").select("telegram_chat_id, timezone").eq("id", user.id).maybeSingle(),
  ]);
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
            <MonthNavArrows
              month={month}
              monthTitle={monthTitle}
              prevLabel={t("prevMonth")}
              nextLabel={t("nextMonth")}
            />
          )
        }
        action={
          <Link
            href={{ pathname: "/calendar/new", query: isThread ? { returnView: "thread" } : undefined }}
            className={buttonClass("primary", "shrink-0 !px-3.5 !py-2")}
          >
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
          <MonthSlide monthKey={format(month, "yyyy-MM")}>
            <MonthView
              month={month}
              events={categorized}
              currentUserId={user.id}
              partnerName={partnerName}
              timeZone={timeZone}
            />
          </MonthSlide>
          <CategoryLegend partnerName={partnerName} />
        </>
      )}
    </main>
  );
}

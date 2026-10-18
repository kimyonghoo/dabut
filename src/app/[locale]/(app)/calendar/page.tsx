import { getLocale, getTranslations } from "next-intl/server";
import { addMonths, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { categorizeEvent } from "@/lib/calendar/categorize-event";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ViewToggle } from "@/components/calendar/view-toggle";
import { MonthView } from "@/components/calendar/month-view";
import { ThreadView } from "@/components/calendar/thread-view";
import { CategoryLegend } from "@/components/calendar/category-legend";
import { getDateFnsLocale, monthTitlePattern, parseMonthParam } from "@/components/calendar/date-locale";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
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
  const { data: events } = await supabase.from("events").select("*");
  const { data: profile } = await supabase
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", user!.id)
    .maybeSingle();

  const categorized = (events ?? []).map((event) => ({
    ...event,
    // visibility is a text check constraint in the DB, not a real Postgres
    // enum, so the generated type is `string`; the constraint guarantees
    // only these two values.
    category: categorizeEvent(
      { owner_id: event.owner_id, visibility: event.visibility as "personal" | "shared" },
      user!.id
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
      <PageHeader
        title={
          isThread ? (
            t("threadView")
          ) : (
            <span className="inline-flex items-center gap-1">
              <Link href={monthHref(addMonths(month, -1))} aria-label={t("prevMonth")} className={navClass}>
                ‹
              </Link>
              <span>{monthTitle}</span>
              <Link href={monthHref(addMonths(month, 1))} aria-label={t("nextMonth")} className={navClass}>
                ›
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
        <ThreadView events={categorized} />
      ) : (
        <>
          <MonthView month={month} events={categorized} />
          <CategoryLegend />
        </>
      )}
    </main>
  );
}

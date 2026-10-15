import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { categorizeEvent } from "@/lib/calendar/categorize-event";
import { Link } from "@/i18n/navigation";
import { ViewToggle } from "@/components/calendar/view-toggle";
import { MonthView } from "@/components/calendar/month-view";
import { ThreadView } from "@/components/calendar/thread-view";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const t = await getTranslations("calendar");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: events } = await supabase.from("events").select("*");

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

  return (
    <main>
      <ViewToggle />
      <Link href="/calendar/new">{t("newEvent")}</Link>
      {view === "thread" ? (
        <ThreadView events={categorized} />
      ) : (
        <MonthView month={new Date()} events={categorized} />
      )}
    </main>
  );
}

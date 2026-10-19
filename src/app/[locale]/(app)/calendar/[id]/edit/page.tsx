import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getTranslations } from "next-intl/server";
import { EventForm } from "@/components/events/event-form";
import { RecurrenceEditScopeChooser } from "@/components/events/recurrence-edit-scope-chooser";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronLeft } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { DEFAULT_TIMEZONE } from "@/lib/dates/timezone";
import { expandRecurringEvent, type RecurrenceFreq, type RecurrenceEndType } from "@/lib/events/recurrence";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function loadPartnerConnections(
  supabase: SupabaseServerClient,
  userId: string
): Promise<Array<{ id: string; partnerEmail: string }>> {
  const { data: memberships } = await supabase
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", userId);
  const connectionIds = (memberships ?? []).map((m) => m.connection_id);
  if (connectionIds.length === 0) return [];

  const { data: otherMembers } = await supabase
    .from("connection_members")
    .select("connection_id, profiles(email)")
    .in("connection_id", connectionIds)
    .neq("user_id", userId);
  return (otherMembers ?? []).map((row) => ({
    id: row.connection_id,
    partnerEmail: (row as unknown as { profiles: { email: string } }).profiles.email,
  }));
}

function EditPageHeader({ t, returnView }: { t: Awaited<ReturnType<typeof getTranslations>>; returnView?: "thread" }) {
  return (
    <PageHeader
      title={
        <span className="flex items-center gap-2">
          <Link
            href={{ pathname: "/calendar", query: returnView ? { view: returnView } : undefined }}
            aria-label={t.has("back") ? t("back") : "Back"}
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
          {t.has("editTitle") ? t("editTitle") : "일정 수정"}
        </span>
      }
    />
  );
}

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ occurrence?: string; returnView?: string }>;
}) {
  const { id } = await params;
  const { occurrence, returnView: returnViewParam } = await searchParams;
  const returnView = returnViewParam === "thread" ? "thread" : undefined;
  const supabase = await createClient();
  const t = await getTranslations("events");
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // AppLayout already redirects unauthenticated visits to /login, but its
  // getUser() call and this one are independent requests to Supabase Auth;
  // fail safe here too instead of crashing on user!.id if one transiently
  // returns no session.
  if (!user) return redirect({ href: "/login", locale });

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single();
  if (!event) notFound();

  // A tap on a computed occurrence of a recurring event (see
  // src/lib/calendar/event-link.ts) links here with `?occurrence=`, instead
  // of straight to a real row's edit page — this event is the series'
  // parent, and the occurrence itself may not exist as a row yet.
  const occurrenceDate = occurrence && /^\d{4}-\d{2}-\d{2}$/.test(occurrence) ? occurrence : null;
  if (event.recurrence_freq && occurrenceDate) {
    const { data: exception } = await supabase
      .from("event_exceptions")
      .select("cancelled, modified_event_id")
      .eq("parent_event_id", id)
      .eq("occurrence_date", occurrenceDate)
      .maybeSingle();

    // Already detached by a prior "이 일정만" edit: skip the prompt
    // entirely and go straight to editing that real, standalone row.
    if (exception?.modified_event_id) {
      return redirect({ href: `/calendar/${exception.modified_event_id}/edit`, locale });
    }
    // Already deleted via "이 일정만" — nothing here for this date.
    if (exception?.cancelled) notFound();

    const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
    const timeZone = profile?.timezone ?? DEFAULT_TIMEZONE;
    const [computedOccurrence] = expandRecurringEvent(
      event,
      {
        freq: event.recurrence_freq as RecurrenceFreq,
        interval: event.recurrence_interval,
        endType: event.recurrence_end_type as RecurrenceEndType,
        until: event.recurrence_until,
        count: event.recurrence_count,
      },
      { start: occurrenceDate, end: occurrenceDate },
      timeZone
    );
    // The date doesn't actually land on a cycle of this rule (e.g. a stale
    // or hand-edited URL, or the rule changed since the link was rendered).
    if (!computedOccurrence) notFound();

    const occurrenceEvent = { ...event, start_at: computedOccurrence.start_at, end_at: computedOccurrence.end_at };
    const connections = await loadPartnerConnections(supabase, user.id);

    return (
      <>
        <EditPageHeader t={t} returnView={returnView} />
        <RecurrenceEditScopeChooser
          event={event}
          occurrenceEvent={occurrenceEvent}
          occurrenceDate={occurrenceDate}
          connections={connections}
          returnView={returnView}
        />
      </>
    );
  }

  const connections = await loadPartnerConnections(supabase, user.id);

  // Either a plain standalone event (never-recurring, or an already-detached
  // exception row), or the series' parent opened directly with no
  // `?occurrence=` — both are a normal scope "all" edit of this exact row.
  return (
    <>
      <EditPageHeader t={t} returnView={returnView} />
      <EventForm mode="edit" event={event} connections={connections} scope="all" returnView={returnView} />
    </>
  );
}

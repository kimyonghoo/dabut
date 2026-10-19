import { createClient } from "@/lib/supabase/server";
import { getLocale, getTranslations } from "next-intl/server";
import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronLeft } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; returnView?: string }>;
}) {
  const { date, returnView: returnViewParam } = await searchParams;
  const returnView = returnViewParam === "thread" ? "thread" : undefined;
  // Only accept a plain yyyy-MM-dd (prefill from the calendar day summary).
  const defaultDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const supabase = await createClient();
  const t = await getTranslations("events");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // AppLayout already redirects unauthenticated visits to /login, but its
  // getUser() call and this one are independent requests to Supabase Auth;
  // fail safe here too instead of crashing on user!.id if one transiently
  // returns no session.
  if (!user) return redirect({ href: "/login", locale: await getLocale() });

  const { data: memberships } = await supabase
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", user.id);
  const connectionIds = (memberships ?? []).map((m) => m.connection_id);

  let connections: Array<{ id: string; partnerEmail: string }> = [];
  if (connectionIds.length > 0) {
    const { data: otherMembers } = await supabase
      .from("connection_members")
      .select("connection_id, profiles(email)")
      .in("connection_id", connectionIds)
      .neq("user_id", user.id);
    connections = (otherMembers ?? []).map((row) => ({
      id: row.connection_id,
      partnerEmail: (row as unknown as { profiles: { email: string } }).profiles.email,
    }));
  }

  return (
    <>
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
            {t.has("newTitle") ? t("newTitle") : "새 일정"}
          </span>
        }
      />
      <EventForm mode="create" connections={connections} defaultDate={defaultDate} returnView={returnView} />
    </>
  );
}

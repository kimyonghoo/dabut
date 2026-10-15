import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/events/event-form";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single();
  if (!event) notFound();

  const { data: memberships } = await supabase
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", user!.id);
  const connectionIds = (memberships ?? []).map((m) => m.connection_id);

  let connections: Array<{ id: string; partnerEmail: string }> = [];
  if (connectionIds.length > 0) {
    const { data: otherMembers } = await supabase
      .from("connection_members")
      .select("connection_id, profiles(email)")
      .in("connection_id", connectionIds)
      .neq("user_id", user!.id);
    connections = (otherMembers ?? []).map((row) => ({
      id: row.connection_id,
      partnerEmail: (row as unknown as { profiles: { email: string } }).profiles.email,
    }));
  }

  return <EventForm mode="edit" event={event} connections={connections} />;
}

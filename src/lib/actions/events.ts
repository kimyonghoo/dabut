"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildEventTimestamps } from "@/lib/events/build-event-timestamps";
import { validateSharedSelection } from "@/lib/events/validate-shared-selection";

export type EventActionState = { error?: string };

async function parseAndBuild(formData: FormData): Promise<ReturnType<typeof buildEventTimestamps>> {
  const mode = formData.get("mode") as "allDay" | "timeRange" | "dateRange";
  return buildEventTimestamps({
    mode,
    startDate: formData.get("startDate") as string,
    startTime: (formData.get("startTime") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
    endTime: (formData.get("endTime") as string) || undefined,
  });
}

function sharedFields(formData: FormData) {
  const isShared = formData.get("shared") === "on";
  const connectionId = (formData.get("connectionId") as string) || null;
  return { isShared, connectionId };
}

// A personal event still needs connection_id set for a connection member to
// see it at all (RLS: owner_id = auth.uid() OR connection member) — the
// "unified calendar" requirement (내 개인 / 상대방의 개인 / 공통 일정) depends
// on it. `shared` only controls `visibility`; connection_id is resolved
// independently, defaulting to the user's first connection when the form
// didn't supply one (i.e. not marked "shared").
async function resolveDefaultConnectionId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1);
  return data && data.length > 0 ? data[0].connection_id : null;
}

export async function createEvent(_prevState: EventActionState, formData: FormData): Promise<EventActionState> {
  const timestamps = await parseAndBuild(formData);
  if ("error" in timestamps) return timestamps;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Title is required" };

  const { isShared, connectionId: selectedConnectionId } = sharedFields(formData);
  const sharedError = validateSharedSelection(isShared, selectedConnectionId);
  if (sharedError) return sharedError;
  const connectionId = isShared ? selectedConnectionId : await resolveDefaultConnectionId(supabase, user.id);

  const { error } = await supabase.from("events").insert({
    owner_id: user.id,
    created_by: user.id,
    connection_id: connectionId,
    visibility: isShared ? "shared" : "personal",
    title,
    location: (formData.get("location") as string) || null,
    companions: (formData.get("companions") as string) || null,
    all_day: timestamps.allDay,
    start_at: timestamps.startAt,
    end_at: timestamps.endAt,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

export async function updateEvent(
  eventId: string,
  _prevState: EventActionState,
  formData: FormData
): Promise<EventActionState> {
  const timestamps = await parseAndBuild(formData);
  if ("error" in timestamps) return timestamps;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Title is required" };

  const { isShared, connectionId: selectedConnectionId } = sharedFields(formData);
  const sharedError = validateSharedSelection(isShared, selectedConnectionId);
  if (sharedError) return sharedError;
  const connectionId = isShared ? selectedConnectionId : await resolveDefaultConnectionId(supabase, user.id);

  const { error } = await supabase
    .from("events")
    .update({
      connection_id: connectionId,
      visibility: isShared ? "shared" : "personal",
      title,
      location: (formData.get("location") as string) || null,
      companions: (formData.get("companions") as string) || null,
      all_day: timestamps.allDay,
      start_at: timestamps.startAt,
      end_at: timestamps.endAt,
    })
    .eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

export async function deleteEvent(eventId: string): Promise<EventActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

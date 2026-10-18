"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildEventTimestamps } from "@/lib/events/build-event-timestamps";
import { validateSharedSelection } from "@/lib/events/validate-shared-selection";
import { eventNotificationMessage } from "@/lib/telegram/messages";
import { notifyConnectionMembers } from "@/lib/telegram/notify-connection";
import { resolveActorName } from "@/lib/telegram/actor-name";
import { DEFAULT_TIMEZONE } from "@/lib/dates/timezone";

export type EventActionState = { error?: string };

type EventToast = "eventCreated" | "eventUpdated" | "eventDeleted";

// redirect() throws NEXT_REDIRECT — must be the last call, outside try/catch.
async function redirectToCalendar(toast: EventToast): Promise<never> {
  return redirect({ href: { pathname: "/calendar", query: { toast } }, locale: await getLocale() });
}

// The naive date/time strings a <datetime-local>-shaped form submits carry no
// timezone of their own; they must be interpreted as the acting user's
// configured timezone (not the server's, which is UTC on Vercel) to land on
// the right UTC instant. This is also the timezone used for the Telegram
// notification's date, since the recipient is typically a partner in the
// same timezone (see src/lib/telegram/messages.ts).
async function resolveActorTimezone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

async function parseAndBuild(
  formData: FormData,
  timeZone: string
): Promise<ReturnType<typeof buildEventTimestamps>> {
  const mode = formData.get("mode") as "allDay" | "timeRange" | "dateRange";
  return buildEventTimestamps({
    mode,
    startDate: formData.get("startDate") as string,
    startTime: (formData.get("startTime") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
    endTime: (formData.get("endTime") as string) || undefined,
    timeZone,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const timeZone = await resolveActorTimezone(supabase, user.id);
  const timestamps = await parseAndBuild(formData, timeZone);
  if ("error" in timestamps) return timestamps;

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

  await notifyConnectionMembers(supabase, {
    connectionId,
    excludeUserId: user.id,
    message: eventNotificationMessage({
      action: "created",
      actorName: await resolveActorName(supabase, user),
      title,
      startAt: timestamps.startAt,
      allDay: timestamps.allDay,
      timeZone,
    }),
  });

  revalidatePath("/", "layout");
  return redirectToCalendar("eventCreated");
}

export async function updateEvent(
  eventId: string,
  _prevState: EventActionState,
  formData: FormData
): Promise<EventActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const timeZone = await resolveActorTimezone(supabase, user.id);
  const timestamps = await parseAndBuild(formData, timeZone);
  if ("error" in timestamps) return timestamps;

  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Title is required" };

  const { isShared, connectionId: selectedConnectionId } = sharedFields(formData);
  const sharedError = validateSharedSelection(isShared, selectedConnectionId);
  if (sharedError) return sharedError;
  const connectionId = isShared ? selectedConnectionId : await resolveDefaultConnectionId(supabase, user.id);

  const { data: updated, error } = await supabase
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
    .eq("id", eventId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };

  // RLS (owner-only update) silently matches 0 rows for a non-owner; only
  // notify when a row was actually updated.
  if (updated) {
    await notifyConnectionMembers(supabase, {
      connectionId,
      excludeUserId: user.id,
      message: eventNotificationMessage({
        action: "updated",
        actorName: await resolveActorName(supabase, user),
        title,
        startAt: timestamps.startAt,
        allDay: timestamps.allDay,
        timeZone,
      }),
    });
  }

  revalidatePath("/", "layout");
  return redirectToCalendar("eventUpdated");
}

export async function deleteEvent(eventId: string): Promise<EventActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // DELETE ... RETURNING: the deleted row feeds the notification, no extra read.
  const { data: deleted, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .select("title, connection_id, start_at, all_day")
    .maybeSingle();
  if (error) return { error: error.message };

  if (deleted) {
    await notifyConnectionMembers(supabase, {
      connectionId: deleted.connection_id,
      excludeUserId: user.id,
      message: eventNotificationMessage({
        action: "deleted",
        actorName: await resolveActorName(supabase, user),
        title: deleted.title,
        startAt: deleted.start_at,
        allDay: deleted.all_day,
        timeZone: await resolveActorTimezone(supabase, user.id),
      }),
    });
  }

  revalidatePath("/", "layout");
  return redirectToCalendar("eventDeleted");
}

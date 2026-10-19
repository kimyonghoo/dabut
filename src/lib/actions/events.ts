"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildEventTimestamps } from "@/lib/events/build-event-timestamps";
import { validateSharedSelection } from "@/lib/events/validate-shared-selection";
import type { RecurrenceFreq, RecurrenceEndType } from "@/lib/events/recurrence";
import { eventNotificationMessage } from "@/lib/telegram/messages";
import { notifyConnectionMembers } from "@/lib/telegram/notify-connection";
import { resolveActorName } from "@/lib/telegram/actor-name";
import { DEFAULT_TIMEZONE } from "@/lib/dates/timezone";

export type EventActionState = { error?: string };

/** Edit/delete scope for a recurring event's occurrence — "this" detaches just the tapped occurrence; "all" acts on the series' parent row directly. Irrelevant (always "all") for a non-recurring event. */
export type EventEditScope = "this" | "all";

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

type RecurrenceDbFields = {
  recurrence_freq: RecurrenceFreq | null;
  recurrence_interval: number;
  recurrence_end_type: RecurrenceEndType | null;
  recurrence_until: string | null;
  recurrence_count: number | null;
};

const NONE_RECURRENCE: RecurrenceDbFields = {
  recurrence_freq: null,
  recurrence_interval: 1,
  recurrence_end_type: null,
  recurrence_until: null,
  recurrence_count: null,
};

const VALID_FREQS: readonly RecurrenceFreq[] = ["daily", "weekly", "monthly", "yearly"];

// Parses the 반복/종료 fields the event form submits (see
// src/components/events/event-form.tsx's "repeat" Card) into the columns
// `events.recurrence_*` expects. Used for create and for a scope "all"
// (whole-series) update — never for a scope "this" detach, since a detached
// single occurrence is always a plain, non-recurring standalone event.
function parseRecurrenceFields(formData: FormData): RecurrenceDbFields | { error: string } {
  const freqInput = (formData.get("recurrenceFreq") as string) || "none";
  if (freqInput === "none") return NONE_RECURRENCE;

  let freq: RecurrenceFreq;
  let interval = 1;
  if (freqInput === "custom") {
    const unit = formData.get("recurrenceCustomUnit") as string;
    if (!VALID_FREQS.includes(unit as RecurrenceFreq)) return { error: "Invalid recurrence frequency" };
    freq = unit as RecurrenceFreq;
    interval = Number(formData.get("recurrenceInterval"));
    if (!Number.isInteger(interval) || interval < 1) return { error: "Repeat interval must be a positive whole number" };
  } else if (VALID_FREQS.includes(freqInput as RecurrenceFreq)) {
    freq = freqInput as RecurrenceFreq;
  } else {
    return { error: "Invalid recurrence frequency" };
  }

  const endType = formData.get("recurrenceEndType") as string;
  if (endType === "never") {
    return { recurrence_freq: freq, recurrence_interval: interval, recurrence_end_type: "never", recurrence_until: null, recurrence_count: null };
  }
  if (endType === "until") {
    const until = formData.get("recurrenceUntil") as string;
    if (!until) return { error: "An end date is required" };
    return { recurrence_freq: freq, recurrence_interval: interval, recurrence_end_type: "until", recurrence_until: until, recurrence_count: null };
  }
  if (endType === "count") {
    const count = Number(formData.get("recurrenceCount"));
    if (!Number.isInteger(count) || count < 1) return { error: "Repeat count must be a positive whole number" };
    return { recurrence_freq: freq, recurrence_interval: interval, recurrence_end_type: "count", recurrence_until: null, recurrence_count: count };
  }
  return { error: "Invalid recurrence end condition" };
}

function readBaseEventFields(formData: FormData, timestamps: { allDay: boolean; startAt: string; endAt: string | null }, connectionId: string | null, isShared: boolean, title: string) {
  return {
    connection_id: connectionId,
    visibility: isShared ? "shared" : "personal",
    title,
    location: (formData.get("location") as string) || null,
    companions: (formData.get("companions") as string) || null,
    all_day: timestamps.allDay,
    start_at: timestamps.startAt,
    end_at: timestamps.endAt,
  };
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

  const recurrence = parseRecurrenceFields(formData);
  if ("error" in recurrence) return recurrence;

  // A newly created recurring event's own row doubles as the series' parent
  // AND its own first occurrence (index 0) — see src/lib/events/recurrence.ts.
  const { error } = await supabase.from("events").insert({
    owner_id: user.id,
    created_by: user.id,
    ...readBaseEventFields(formData, timestamps, connectionId, isShared, title),
    ...recurrence,
  });
  if (error) return { error: error.message };

  // Notify once for the series itself (not per future occurrence) — matches
  // the "edited/created the series" treatment on update/delete below.
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
  scope: EventEditScope,
  occurrenceDate: string | null,
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
  const baseFields = readBaseEventFields(formData, timestamps, connectionId, isShared, title);

  if (scope === "this" && occurrenceDate) {
    return updateSingleOccurrence(supabase, user, eventId, occurrenceDate, baseFields, title, timestamps, timeZone);
  }

  // scope "all" (or a plain, never-recurring event): edit the parent/standalone row directly, including its recurrence rule.
  const recurrence = parseRecurrenceFields(formData);
  if ("error" in recurrence) return recurrence;

  const { data: updated, error } = await supabase
    .from("events")
    .update({ ...baseFields, ...recurrence })
    .eq("id", eventId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };

  // RLS (owner-only update) silently matches 0 rows for a non-owner; only
  // notify when a row was actually updated. Fires once for the series as a
  // whole, not per occurrence — see module docs on notification strategy.
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

// Detaches a single occurrence of a recurring series into its own standalone
// `events` row with the edited details, recording the detachment as an
// exception on the parent (creating a brand new detached row the first time
// this occurrence is touched, or updating the existing one on a later edit).
// This is a genuine one-off action, so — unlike a scope "all" edit — it gets
// its own normal "updated" notification (see module docs).
async function updateSingleOccurrence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string },
  parentEventId: string,
  occurrenceDate: string,
  baseFields: ReturnType<typeof readBaseEventFields>,
  title: string,
  timestamps: { allDay: boolean; startAt: string; endAt: string | null },
  timeZone: string
): Promise<EventActionState> {
  const { data: parent, error: parentError } = await supabase
    .from("events")
    .select("owner_id")
    .eq("id", parentEventId)
    .maybeSingle();
  if (parentError) return { error: parentError.message };
  if (!parent) return { error: "Event not found" };
  // Only the series owner can detach/edit an occurrence — mirrors the
  // owner-only mutate policy the rest of this module relies on, but checked
  // explicitly here (rather than left to RLS) because this path performs two
  // writes (the new event row, then its exception) that must not partially
  // succeed for a non-owner.
  if (parent.owner_id !== user.id) return { error: "Not authorized" };

  const { data: existingException, error: exceptionLookupError } = await supabase
    .from("event_exceptions")
    .select("modified_event_id")
    .eq("parent_event_id", parentEventId)
    .eq("occurrence_date", occurrenceDate)
    .maybeSingle();
  if (exceptionLookupError) return { error: exceptionLookupError.message };

  let detachedEventId = existingException?.modified_event_id ?? null;
  if (detachedEventId) {
    const { error } = await supabase.from("events").update(baseFields).eq("id", detachedEventId);
    if (error) return { error: error.message };
  } else {
    const { data: inserted, error } = await supabase
      .from("events")
      .insert({ owner_id: user.id, created_by: user.id, ...baseFields })
      .select("id")
      .single();
    if (error) return { error: error.message };
    detachedEventId = inserted.id;
    const { error: exceptionError } = await supabase
      .from("event_exceptions")
      .insert({ parent_event_id: parentEventId, occurrence_date: occurrenceDate, cancelled: false, modified_event_id: detachedEventId });
    if (exceptionError) return { error: exceptionError.message };
  }

  await notifyConnectionMembers(supabase, {
    connectionId: baseFields.connection_id,
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

  revalidatePath("/", "layout");
  return redirectToCalendar("eventUpdated");
}

export async function deleteEvent(
  eventId: string,
  scope: EventEditScope = "all",
  occurrenceDate: string | null = null
): Promise<EventActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (scope === "this" && occurrenceDate) {
    return deleteSingleOccurrence(supabase, user, eventId, occurrenceDate);
  }

  // scope "all" (or a plain, never-recurring event): delete the whole
  // series/standalone row. Also clean up any detached per-occurrence rows
  // first — the parent's own exception rows cascade via the FK, but a
  // detached occurrence's *standalone* event row is a separate row the
  // cascade doesn't reach, and leaving it behind would orphan it.
  const { data: exceptions } = await supabase
    .from("event_exceptions")
    .select("modified_event_id")
    .eq("parent_event_id", eventId)
    .not("modified_event_id", "is", null);
  const detachedIds = (exceptions ?? [])
    .map((row) => row.modified_event_id)
    .filter((id): id is string => id != null);
  if (detachedIds.length > 0) {
    await supabase.from("events").delete().in("id", detachedIds);
  }

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

// Deletes just one occurrence of a recurring series: if it was already
// detached into its own row (a prior "이 일정만" edit), that row is deleted
// outright — the `events_detach_cleanup` DB trigger converts its exception
// into a plain "cancelled" one automatically, so the original computed
// occurrence does not reappear. Otherwise, records a fresh "cancelled"
// exception so expansion skips that date going forward.
async function deleteSingleOccurrence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string },
  parentEventId: string,
  occurrenceDate: string
): Promise<EventActionState> {
  const { data: parent, error: parentError } = await supabase
    .from("events")
    .select("title, connection_id, start_at, all_day, owner_id")
    .eq("id", parentEventId)
    .maybeSingle();
  if (parentError) return { error: parentError.message };
  if (!parent) return { error: "Event not found" };
  if (parent.owner_id !== user.id) return { error: "Not authorized" };

  const { data: existingException, error: lookupError } = await supabase
    .from("event_exceptions")
    .select("id, modified_event_id")
    .eq("parent_event_id", parentEventId)
    .eq("occurrence_date", occurrenceDate)
    .maybeSingle();
  if (lookupError) return { error: lookupError.message };

  if (existingException?.modified_event_id) {
    const { error } = await supabase.from("events").delete().eq("id", existingException.modified_event_id);
    if (error) return { error: error.message };
  } else if (!existingException) {
    const { error } = await supabase
      .from("event_exceptions")
      .insert({ parent_event_id: parentEventId, occurrence_date: occurrenceDate, cancelled: true });
    if (error) return { error: error.message };
  }
  // else: already cancelled — nothing to do, treat as success.

  await notifyConnectionMembers(supabase, {
    connectionId: parent.connection_id,
    excludeUserId: user.id,
    message: eventNotificationMessage({
      action: "deleted",
      actorName: await resolveActorName(supabase, user),
      title: parent.title,
      startAt: parent.start_at,
      allDay: parent.all_day,
      timeZone: await resolveActorTimezone(supabase, user.id),
    }),
  });

  revalidatePath("/", "layout");
  return redirectToCalendar("eventDeleted");
}

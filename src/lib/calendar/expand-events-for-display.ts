import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  expandRecurringEvent,
  defaultExpansionWindow,
  type RecurrenceFreq,
  type RecurrenceEndType,
} from "@/lib/events/recurrence";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

/**
 * Expands every recurring parent in `events` into its visible-range
 * computed occurrences and merges the result with the plain/standalone rows
 * (which already include any detached exception events — those are just
 * normal `events` rows). The raw recurring parent row itself is dropped from
 * the result: it's always represented by its own computed occurrences
 * instead (including the cycle that lands on its original start date), so
 * UI never links to it directly — see src/lib/calendar/event-link.ts.
 *
 * This is the one place that knows about `event_exceptions` on the read
 * path; every calendar display component downstream (MonthView, ThreadView,
 * DaySummarySheet, ThreadList) keeps working with a plain `EventRow[]`
 * unchanged, since a computed occurrence is shaped exactly like a real row
 * (same fields) with a synthetic `id`.
 */
export async function expandEventsForDisplay(
  supabase: SupabaseClient<Database>,
  events: EventRow[],
  timeZone: string
): Promise<EventRow[]> {
  const recurringParents = events.filter((event) => event.recurrence_freq);
  const plainEvents = events.filter((event) => !event.recurrence_freq);
  if (recurringParents.length === 0) return plainEvents;

  const { data: exceptions } = await supabase
    .from("event_exceptions")
    .select("parent_event_id, occurrence_date")
    .in(
      "parent_event_id",
      recurringParents.map((event) => event.id)
    );

  const exceptionDatesByParent = new Map<string, Set<string>>();
  for (const row of exceptions ?? []) {
    const set = exceptionDatesByParent.get(row.parent_event_id) ?? new Set<string>();
    set.add(row.occurrence_date);
    exceptionDatesByParent.set(row.parent_event_id, set);
  }

  const window = defaultExpansionWindow(new Date().toISOString(), timeZone);
  const computed: EventRow[] = [];
  for (const parent of recurringParents) {
    const occurrences = expandRecurringEvent(
      parent,
      {
        freq: parent.recurrence_freq as RecurrenceFreq,
        interval: parent.recurrence_interval,
        endType: parent.recurrence_end_type as RecurrenceEndType,
        until: parent.recurrence_until,
        count: parent.recurrence_count,
      },
      window,
      timeZone,
      exceptionDatesByParent.get(parent.id) ?? new Set()
    );
    for (const occurrence of occurrences) {
      computed.push({ ...parent, id: occurrence.id, start_at: occurrence.start_at, end_at: occurrence.end_at });
    }
  }

  return [...plainEvents, ...computed];
}

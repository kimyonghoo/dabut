import { parseOccurrenceId } from "@/lib/events/occurrence-id";

/**
 * Edit-page href for a calendar item, given its `id`. A plain/standalone
 * event (including an already-detached exception row) links straight to its
 * own edit page; a computed recurring occurrence (synthetic id, see
 * occurrence-id.ts) links to its *parent's* edit page with `?occurrence=`,
 * so the edit page can offer the "이 일정만 / 모든 일정" choice before
 * showing the form. This never misfires on a real row's id: a UUID never
 * contains `:`, so `parseOccurrenceId` only matches a synthetic id.
 *
 * `returnView`, when given, threads which calendar view the link was reached
 * from (currently only "thread" is meaningful) down into the edit flow, so a
 * save/delete that follows can redirect back to that view instead of always
 * landing on month view — see `redirectToCalendar` in
 * `src/lib/actions/events.ts`.
 */
export function eventEditHref(eventId: string, returnView?: "thread"): string {
  const parsed = parseOccurrenceId(eventId);
  const base = parsed
    ? `/calendar/${parsed.parentEventId}/edit`
    : `/calendar/${eventId}/edit`;
  const params = new URLSearchParams();
  if (parsed) params.set("occurrence", parsed.occurrenceDate);
  if (returnView) params.set("returnView", returnView);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** True when `eventId` is a computed occurrence's synthetic id rather than a real `events` row. */
export function isVirtualOccurrence(eventId: string): boolean {
  return parseOccurrenceId(eventId) !== null;
}

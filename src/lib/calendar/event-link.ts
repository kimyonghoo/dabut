import { parseOccurrenceId } from "@/lib/events/occurrence-id";

/**
 * Edit-page href for a calendar item, given its `id`. A plain/standalone
 * event (including an already-detached exception row) links straight to its
 * own edit page; a computed recurring occurrence (synthetic id, see
 * occurrence-id.ts) links to its *parent's* edit page with `?occurrence=`,
 * so the edit page can offer the "이 일정만 / 모든 일정" choice before
 * showing the form. This never misfires on a real row's id: a UUID never
 * contains `:`, so `parseOccurrenceId` only matches a synthetic id.
 */
export function eventEditHref(eventId: string): string {
  const parsed = parseOccurrenceId(eventId);
  if (!parsed) return `/calendar/${eventId}/edit`;
  return `/calendar/${parsed.parentEventId}/edit?occurrence=${parsed.occurrenceDate}`;
}

/** True when `eventId` is a computed occurrence's synthetic id rather than a real `events` row. */
export function isVirtualOccurrence(eventId: string): boolean {
  return parseOccurrenceId(eventId) !== null;
}

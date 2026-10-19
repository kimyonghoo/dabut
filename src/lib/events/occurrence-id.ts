/**
 * Identity scheme for a *computed* (non-exception) occurrence of a recurring
 * event — one that exists only as a result of expansion, not as a real
 * `events` row. Calendar UI needs a stable `id` for such an item (for React
 * keys and click-through) without it colliding with any real row id, so a
 * computed occurrence's id is `${parentEventId}:${occurrenceDate}` instead
 * of a UUID.
 *
 * This is unambiguous because `events.id` is always a UUID (never contains
 * `:`), so `indexOf(":")` safely separates the two parts. The three kinds of
 * calendar item the UI can encounter are:
 *  - a plain/standalone `events` row (non-recurring, or a detached
 *    exception's own row) — its `id` is a plain UUID, no `occurrenceDate`.
 *  - the recurring *parent* `events` row, addressed directly (no
 *    `occurrenceDate`) — editing/deleting it means the whole series.
 *  - a *computed occurrence* — this synthetic id, carrying both the parent's
 *    real UUID and which cycle (by original calendar date) it is.
 */
export function buildOccurrenceId(parentEventId: string, occurrenceDate: string): string {
  return `${parentEventId}:${occurrenceDate}`;
}

export function parseOccurrenceId(id: string): { parentEventId: string; occurrenceDate: string } | null {
  const separatorIndex = id.indexOf(":");
  if (separatorIndex === -1) return null;
  const parentEventId = id.slice(0, separatorIndex);
  const occurrenceDate = id.slice(separatorIndex + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) return null;
  return { parentEventId, occurrenceDate };
}

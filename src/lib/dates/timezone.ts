/**
 * Single source of truth for turning a timezone-less ("naive") wall-clock
 * value into a real UTC instant, and for formatting a stored UTC instant
 * back into wall-clock text — both anchored to an explicit IANA timezone
 * rather than whatever zone the runtime (browser or server) happens to be
 * in. A `datetime-local`-shaped input carries no timezone info at all, so
 * whichever code turns it into an ISO string for storage and whichever code
 * formats it back for display MUST agree on which zone a naive value means;
 * every function here takes that zone explicitly instead of assuming it.
 *
 * No UTC-offset arithmetic is hand-rolled: offsets are derived from
 * `Intl.DateTimeFormat` (which already knows each zone's rules, including
 * DST), not hardcoded.
 */

/** This app's users are primarily Korean; also `profiles.timezone`'s default. */
export const DEFAULT_TIMEZONE = "Asia/Seoul";

/** Short, curated list offered in the settings UI — not an exhaustive IANA combobox. */
export const TIMEZONE_CHOICES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "Asia/Seoul", label: "서울 (Seoul)" },
  { value: "Asia/Tokyo", label: "도쿄 (Tokyo)" },
  { value: "Asia/Shanghai", label: "베이징 (Beijing)" },
  { value: "America/New_York", label: "뉴욕 (New York)" },
  { value: "America/Los_Angeles", label: "LA (Los Angeles)" },
];

type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  /** 0 (Sun) - 6 (Sat), derived from the zoned y/m/d (not the instant's UTC day). */
  weekday: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The wall-clock parts `instant` reads as inside `timeZone`. */
function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const typed: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") typed[part.type] = Number(part.value);
  }
  const { year, month, day, minute, second } = typed;
  // Some engines report midnight as hour "24" under hourCycle h23; normalize.
  const hour = typed.hour % 24;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, hour, minute, second, weekday };
}

/** How far `timeZone` is ahead of UTC (ms) at `instant` — positive east of UTC. */
function offsetMsAt(instant: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = getZonedParts(instant, timeZone);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - instant.getTime();
}

function parseTimeStr(timeStr: string | undefined): { hour: number; minute: number; second: number } {
  const [h = "0", mi = "0", s = "0"] = (timeStr ?? "00:00:00").split(":");
  return { hour: Number(h), minute: Number(mi), second: Number(s.split(".")[0]) };
}

/**
 * Interprets a naive `yyyy-MM-dd` date and an optional `HH:mm`/`HH:mm:ss`
 * time as wall-clock values inside `timeZone`, and returns the UTC instant
 * they refer to, as an ISO string. This is the one place a timezone-less
 * form input becomes a real instant for storage.
 */
export function zonedDateTimeToUtcIso(dateStr: string, timeStr: string | undefined, timeZone: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const { hour, minute, second } = parseTimeStr(timeStr);
  // Standard fixed-point approach: guess the instant by treating the wall
  // clock as if it were UTC, measure that zone's actual offset at the
  // guess, then correct — redone once more in case the correction crossed
  // a DST boundary.
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset1 = offsetMsAt(new Date(guess), timeZone);
  let utcMs = guess - offset1;
  const offset2 = offsetMsAt(new Date(utcMs), timeZone);
  if (offset2 !== offset1) utcMs = guess - offset2;
  return new Date(utcMs).toISOString();
}

/** Wall-clock parts of a stored UTC instant (ISO string), as seen in `timeZone`. */
export function zonedDateParts(isoInstant: string, timeZone: string): ZonedParts {
  return getZonedParts(new Date(isoInstant), timeZone);
}

/** `yyyy-MM-dd` value for an `<input type="date">`, for `isoInstant` in `timeZone`. */
export function toZonedDateInputValue(isoInstant: string, timeZone: string): string {
  const { year, month, day } = zonedDateParts(isoInstant, timeZone);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** `HH:mm` value for an `<input type="time">`, for `isoInstant` in `timeZone`. */
export function toZonedTimeInputValue(isoInstant: string, timeZone: string): string {
  const { hour, minute } = zonedDateParts(isoInstant, timeZone);
  return `${pad2(hour)}:${pad2(minute)}`;
}

/**
 * `yyyy-MM-dd` for the calendar day right after `instant`'s wall-clock date
 * in `timeZone` — e.g. "what day is tomorrow for this user right now",
 * for the daily digest cron to know which day's events to summarize.
 */
export function tomorrowDateKeyInTimeZone(instant: Date, timeZone: string): string {
  const { year, month, day } = zonedDateParts(instant.toISOString(), timeZone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

/**
 * Formats a stored UTC instant for display, anchored to `timeZone` — a thin
 * wrapper over `Intl.DateTimeFormat`, no arithmetic. `locale` accepts the
 * app's simple locale codes ("ko" | "en" | "zh"), which `Intl` understands
 * as BCP 47 primary language subtags.
 */
export function formatInTimeZone(
  isoInstant: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "ko"
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(isoInstant));
}

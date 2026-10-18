export type RelativeDay = "today" | "yesterday" | "tomorrow";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseKey(key: string): number | null {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** `yyyy-MM-dd` of a Date in the runtime's local time zone. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "today" / "yesterday" / "tomorrow" relative to `todayKey`, else null. Both keys are `yyyy-MM-dd`. */
export function getRelativeDay(dateKey: string, todayKey: string): RelativeDay | null {
  const date = parseKey(dateKey);
  const today = parseKey(todayKey);
  if (date === null || today === null) return null;
  const diff = Math.round((date - today) / DAY_MS);
  if (diff === 0) return "today";
  if (diff === -1) return "yesterday";
  if (diff === 1) return "tomorrow";
  return null;
}

/**
 * Plain, locale-appropriate date for a `yyyy-MM-dd` key, e.g.
 * ko "10월 18일 (일)", en "Sun, October 18", zh "10月18日周日".
 * The year is added only when it differs from `todayKey`'s year.
 */
export function formatDateKey(dateKey: string, locale: string, todayKey?: string): string {
  const date = parseKey(dateKey);
  if (date === null) return dateKey;
  const showYear = !!todayKey && todayKey.slice(0, 4) !== dateKey.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    ...(showYear ? { year: "numeric" } : {}),
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(date));
}

/** Relative label ("Today"…) when applicable, otherwise the plain formatted date. */
export function dateGroupLabel(
  dateKey: string,
  todayKey: string,
  locale: string,
  translate: (key: RelativeDay) => string
): string {
  const relative = getRelativeDay(dateKey, todayKey);
  return relative ? translate(relative) : formatDateKey(dateKey, locale, todayKey);
}

import Holidays from "date-holidays";
import { toZonedDateInputValue } from "@/lib/dates/timezone";

/**
 * Country for each timezone this app's timezone picker offers (see
 * TIMEZONE_CHOICES in lib/dates/timezone.ts) — the only timezones a real
 * user can be on, so this map only needs to cover those five. An unmapped
 * timezone (shouldn't normally happen) just yields no holidays rather than
 * throwing: this is decoration on the calendar, never a hard requirement.
 */
const TIMEZONE_COUNTRY: Record<string, string> = {
  "Asia/Seoul": "KR",
  "Asia/Tokyo": "JP",
  "Asia/Shanghai": "CN",
  "America/New_York": "US",
  "America/Los_Angeles": "US",
};

/** "yyyy-MM-dd" + 1 day, as plain calendar-date arithmetic (no timezone involved). */
function nextDateKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(
    next.getUTCDate()
  ).padStart(2, "0")}`;
}

/** App locale -> date-holidays language code; both use plain ISO 639-1 codes. */
function holidayLanguage(locale: string): string {
  if (locale === "ko" || locale === "zh") return locale;
  return "en";
}

// One Holidays instance per (country, language) pair, reused across renders —
// construction parses that country's whole rule set (including lunar-calendar
// rules), so it's worth not redoing per month.
const instances = new Map<string, Holidays>();

function getInstance(country: string, locale: string): Holidays {
  const language = holidayLanguage(locale);
  const key = `${country}:${language}`;
  let hd = instances.get(key);
  if (!hd) {
    hd = new Holidays(country, { languages: [language, "en"] });
    instances.set(key, hd);
  }
  return hd;
}

/**
 * Public holidays for `timeZone`'s country in `year`, keyed by "yyyy-MM-dd"
 * in that holiday's own local date. Computed purely from date-holidays'
 * built-in rules (including lunar-calendar holidays like 설날/추석) — no DB
 * row or network call, so there's nothing to keep in sync across years.
 */
export function getHolidaysForYear(year: number, timeZone: string, locale: string): Map<string, string> {
  const country = TIMEZONE_COUNTRY[timeZone];
  if (!country) return new Map();
  const hd = getInstance(country, locale);
  const holidays = hd.getHolidays(year).filter((h) => h.type === "public");
  const map = new Map<string, string>();
  for (const holiday of holidays) {
    // Some holidays (e.g. KR's 설날/추석) span multiple days — `start`/`end`
    // mark the real range (end is the exclusive start of the next day), so
    // every day in between is marked, not just the rule's nominal date.
    const startKey = toZonedDateInputValue(holiday.start.toISOString(), timeZone);
    const endKey = toZonedDateInputValue(new Date(holiday.end.getTime() - 1).toISOString(), timeZone);
    for (let key = startKey; key <= endKey; key = nextDateKey(key)) {
      if (!map.has(key)) map.set(key, holiday.name);
    }
  }
  return map;
}

import { format } from "date-fns";
import { enUS, ko, zhCN, type Locale } from "date-fns/locale";

const LOCALES: Record<string, Locale> = { ko, en: enUS, zh: zhCN };

/**
 * `/calendar?month=yyyy-MM` (or `/ledger?month=yyyy-MM`) href for a given
 * month — the single source of this URL shape, shared by the page header's
 * prev/next month links and the month grid's swipe gesture, so the
 * navigation paths can never drift apart. `extraQuery` carries along other
 * params the current view needs to keep (e.g. `view=thread`) so switching
 * months never silently drops the caller back into the default view.
 */
export function monthHref(
  date: Date,
  pathname: "/calendar" | "/ledger" = "/calendar",
  extraQuery?: Record<string, string>
) {
  return { pathname, query: { ...extraQuery, month: format(date, "yyyy-MM") } };
}

export function getDateFnsLocale(locale: string): Locale {
  return LOCALES[locale] ?? ko;
}

/** Locale-aware "2026년 10월" / "October 2026" / "2026年10月" pattern. */
export function monthTitlePattern(locale: string): string {
  if (locale === "en") return "MMMM yyyy";
  if (locale === "zh") return "yyyy年 M月";
  return "yyyy년 M월";
}

/** Parse a ?month=YYYY-MM search param; falls back to the current month. */
export function parseMonthParam(value: string | undefined): Date {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    if (month >= 0 && month <= 11) return new Date(year, month, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

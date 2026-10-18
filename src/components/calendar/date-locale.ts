import { enUS, ko, zhCN, type Locale } from "date-fns/locale";

const LOCALES: Record<string, Locale> = { ko, en: enUS, zh: zhCN };

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

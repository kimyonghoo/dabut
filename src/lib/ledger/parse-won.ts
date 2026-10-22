/** numeric(12,2) holds up to 9,999,999,999.99 — keep goals comfortably below it. */
export const MAX_WON = 9_999_999_999;

/**
 * Parses a won amount typed by a person. Accepts plain digits ("2000000"),
 * thousands separators ("2,000,000"), a trailing "원", and Korean unit
 * shorthand ("200만", "1억", "1억 5천만", "2.5만"). Returns whole won.
 */
export function parseWon(raw: string): { value: number | null } | { error: "invalid" } {
  const text = raw.replace(/[,\s]/g, "").replace(/원$/, "");
  if (!text) return { value: null };

  const n = "(\\d+(?:\\.\\d+)?)";
  const unit = text.match(new RegExp(`^(?:${n}억)?(?:${n}천만)?(?:${n}만)?(?:${n}천)?(?:${n})?$`));
  if (!unit) return { error: "invalid" };
  const [, eok, cheonman, man, cheon, rest] = unit;
  if ([eok, cheonman, man, cheon, rest].every((part) => part === undefined)) return { error: "invalid" };
  const total =
    Number(eok ?? 0) * 100_000_000 +
    Number(cheonman ?? 0) * 10_000_000 +
    Number(man ?? 0) * 10_000 +
    Number(cheon ?? 0) * 1_000 +
    Number(rest ?? 0);
  if (!Number.isFinite(total) || total < 0 || total > MAX_WON) return { error: "invalid" };
  return { value: Math.round(total) };
}

/** "2,000,000원 (200만원)" style preview text for the input helper line. */
export function formatWonPreview(value: number): string {
  const full = `${value.toLocaleString("ko-KR")}원`;
  if (value < 10_000 || value % 10_000 !== 0) return full;
  const eok = Math.floor(value / 100_000_000);
  const man = (value % 100_000_000) / 10_000;
  const short = `${eok ? `${eok}억 ` : ""}${man ? `${man.toLocaleString("ko-KR")}만` : ""}원`.trim();
  return `${full} (${short})`;
}

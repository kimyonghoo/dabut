// Nickname rules for `profiles.display_name`. Characters are restricted to
// letters (any script, so Korean/English/etc. all work via \p{L}) and
// numbers — no spaces or symbols. That keeps the 2-letter avatar initials
// (connection-manager.tsx) and Telegram notification text predictable, and
// rules out lookalike/invisible-character spoofing via whitespace or
// punctuation. Length bounds are arbitrary but generous for a nickname.
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

export type NicknameRule = "tooShort" | "tooLong" | "invalidChars";

export const NICKNAME_RULES: readonly NicknameRule[] = ["tooShort", "tooLong", "invalidChars"];

const ALLOWED_CHARS = /^[\p{L}\p{N}]+$/u;

function trimmedLength(nickname: string): number {
  return Array.from(nickname.trim()).length;
}

const CHECKS: Record<NicknameRule, (nickname: string) => boolean> = {
  tooShort: (nickname) => trimmedLength(nickname) >= NICKNAME_MIN_LENGTH,
  tooLong: (nickname) => trimmedLength(nickname) <= NICKNAME_MAX_LENGTH,
  // Vacuously fine on an empty value — tooShort already covers that case,
  // and flagging "invalid characters" on a blank field would be confusing.
  invalidChars: (nickname) => {
    const trimmed = nickname.trim();
    return trimmed.length === 0 || ALLOWED_CHARS.test(trimmed);
  },
};

/** Per-rule pass/fail map, used for live hints in a form. */
export function checkNickname(nickname: string): Record<NicknameRule, boolean> {
  return {
    tooShort: CHECKS.tooShort(nickname),
    tooLong: CHECKS.tooLong(nickname),
    invalidChars: CHECKS.invalidChars(nickname),
  };
}

/** Rules the nickname fails, in display order. Empty array = valid. */
export function nicknameViolations(nickname: string): NicknameRule[] {
  const result = checkNickname(nickname);
  return NICKNAME_RULES.filter((rule) => !result[rule]);
}

export function isNicknameValid(nickname: string): boolean {
  return nicknameViolations(nickname).length === 0;
}

/** Trimmed nickname ready to store — call only after isNicknameValid(). */
export function normalizeNickname(nickname: string): string {
  return nickname.trim();
}

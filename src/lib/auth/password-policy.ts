export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRule = "minLength" | "digit" | "symbol";

export const PASSWORD_RULES: readonly PasswordRule[] = ["minLength", "digit", "symbol"];

const CHECKS: Record<PasswordRule, (password: string) => boolean> = {
  // Count code points so an emoji or CJK char counts as one character.
  minLength: (password) => Array.from(password).length >= PASSWORD_MIN_LENGTH,
  digit: (password) => /\p{Nd}/u.test(password),
  // Anything that is not a letter, number or whitespace counts as a symbol.
  symbol: (password) => /[^\p{L}\p{N}\s]/u.test(password),
};

/** Per-rule pass/fail map, used for live hints in the form. */
export function checkPassword(password: string): Record<PasswordRule, boolean> {
  return {
    minLength: CHECKS.minLength(password),
    digit: CHECKS.digit(password),
    symbol: CHECKS.symbol(password),
  };
}

/** Rules the password fails, in display order. Empty array = valid. */
export function passwordViolations(password: string): PasswordRule[] {
  const result = checkPassword(password);
  return PASSWORD_RULES.filter((rule) => !result[rule]);
}

export function isPasswordValid(password: string): boolean {
  return passwordViolations(password).length === 0;
}

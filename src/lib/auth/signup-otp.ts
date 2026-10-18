import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

/** How long a `?start=signup_<token>` Telegram deep link stays usable. */
export const SIGNUP_LINK_TTL_MS = 30 * 60 * 1000;
/** How long a generated OTP stays usable once sent. */
export const OTP_TTL_MS = 10 * 60 * 1000;
/** Minimum gap between two OTP sends for the same token (anti-hammering). */
export const OTP_RESEND_COOLDOWN_MS = 25 * 1000;
/** Wrong-OTP attempts allowed before the verification row is invalidated. */
export const MAX_OTP_ATTEMPTS = 5;
/**
 * How old an abandoned, still-unconfirmed signup must be before its email
 * can be reclaimed by a fresh signup attempt.
 */
export const SIGNUP_STALE_TTL_MS = 30 * 60 * 1000;

/** Fresh high-entropy, single-use signup token (also used as the OTP hash's salt — see hashOtp). */
export function generateSignupToken(): string {
  return randomUUID().replace(/-/g, "");
}

/** Cryptographically random 6-digit numeric OTP (never Math.random). */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * OTP hashing scheme: sha256(token + ":" + otp).
 *
 * The token is itself a high-entropy (32 hex char), server-generated,
 * single-use secret — not user-chosen and not guessable — so it doubles as
 * a per-row salt without a separate salt column. This means:
 *   - the OTP is never stored in plaintext, anywhere (not even logs);
 *   - two signups never produce the same hash for the same OTP digits,
 *     because every row has a different token/salt;
 *   - the digest has a fixed 64-hex-character length, which is what lets
 *     comparisons safely use a constant-time equality check (see otpMatches).
 */
export function hashOtp(token: string, otp: string): string {
  return createHash("sha256").update(`${token}:${otp}`).digest("hex");
}

/** Constant-time comparison of a submitted OTP against the stored hash. */
export function otpMatches(token: string, submittedOtp: string, storedHash: string): boolean {
  const expected = Buffer.from(hashOtp(token, submittedOtp), "utf8");
  const actual = Buffer.from(storedHash, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** True when `isoDate` is missing or already in the past. */
export function isExpired(isoDate: string | null | undefined): boolean {
  if (!isoDate) return true;
  return new Date(isoDate).getTime() <= Date.now();
}

/** ISO timestamp `ms` milliseconds from now, for *_expires_at columns. */
export function futureIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

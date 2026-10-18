import { describe, expect, it } from "vitest";
import {
  MAX_OTP_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  SIGNUP_LINK_TTL_MS,
  futureIso,
  generateOtp,
  generateSignupToken,
  hashOtp,
  isExpired,
  otpMatches,
} from "./signup-otp";

describe("generateSignupToken", () => {
  it("returns a 32-char hex string with no dashes", () => {
    const token = generateSignupToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns a different token on each call", () => {
    expect(generateSignupToken()).not.toBe(generateSignupToken());
  });
});

describe("generateOtp", () => {
  it("returns a zero-padded 6-digit numeric string", () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtp / otpMatches", () => {
  it("matches when token + otp are the same", () => {
    const token = generateSignupToken();
    const hash = hashOtp(token, "123456");
    expect(otpMatches(token, "123456", hash)).toBe(true);
  });

  it("rejects a wrong OTP", () => {
    const token = generateSignupToken();
    const hash = hashOtp(token, "123456");
    expect(otpMatches(token, "654321", hash)).toBe(false);
  });

  it("rejects the right OTP hashed under a different token (no cross-row reuse)", () => {
    const tokenA = generateSignupToken();
    const tokenB = generateSignupToken();
    const hash = hashOtp(tokenA, "123456");
    expect(otpMatches(tokenB, "123456", hash)).toBe(false);
  });

  it("never throws on a malformed/short stored hash (length mismatch path)", () => {
    const token = generateSignupToken();
    expect(otpMatches(token, "123456", "not-a-real-hash")).toBe(false);
  });

  it("the stored hash is never the plaintext OTP", () => {
    const token = generateSignupToken();
    const hash = hashOtp(token, "123456");
    expect(hash).not.toContain("123456");
    expect(hash).toHaveLength(64);
  });
});

describe("isExpired", () => {
  it("treats null/undefined as expired", () => {
    expect(isExpired(null)).toBe(true);
    expect(isExpired(undefined)).toBe(true);
  });

  it("treats a past timestamp as expired", () => {
    expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  it("treats a future timestamp as not expired", () => {
    expect(isExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });
});

describe("futureIso", () => {
  it("returns an ISO timestamp roughly `ms` in the future", () => {
    const before = Date.now();
    const iso = futureIso(10_000);
    const delta = new Date(iso).getTime() - before;
    expect(delta).toBeGreaterThanOrEqual(9_000);
    expect(delta).toBeLessThanOrEqual(11_000);
  });
});

describe("tuning constants", () => {
  it("keeps sane relative ordering (OTP TTL shorter than link TTL, resend cooldown shorter than OTP TTL)", () => {
    expect(OTP_TTL_MS).toBeLessThan(SIGNUP_LINK_TTL_MS);
    expect(OTP_RESEND_COOLDOWN_MS).toBeLessThan(OTP_TTL_MS);
    expect(MAX_OTP_ATTEMPTS).toBeGreaterThan(0);
  });
});

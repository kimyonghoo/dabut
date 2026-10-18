import { describe, expect, it } from "vitest";
import { checkPassword, isPasswordValid, passwordViolations } from "./password-policy";

describe("password policy", () => {
  it("accepts a password with 8+ chars, a digit and a symbol", () => {
    expect(isPasswordValid("abcdef1!")).toBe(true);
    expect(isPasswordValid("다붓다붓다붓1#")).toBe(true);
    expect(passwordViolations("correct-horse-9")).toEqual([]);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(passwordViolations("ab1!xyz")).toEqual(["minLength"]);
  });

  it("requires at least one digit", () => {
    expect(passwordViolations("abcdefg!")).toEqual(["digit"]);
  });

  it("requires at least one symbol", () => {
    expect(passwordViolations("abcdefg1")).toEqual(["symbol"]);
  });

  it("does not count whitespace as a symbol", () => {
    expect(passwordViolations("abcdef 1")).toEqual(["symbol"]);
  });

  it("reports every failing rule in order", () => {
    expect(passwordViolations("")).toEqual(["minLength", "digit", "symbol"]);
    expect(passwordViolations("abc")).toEqual(["minLength", "digit", "symbol"]);
  });

  it("returns a per-rule map for live hints", () => {
    expect(checkPassword("12345678")).toEqual({ minLength: true, digit: true, symbol: false });
  });
});

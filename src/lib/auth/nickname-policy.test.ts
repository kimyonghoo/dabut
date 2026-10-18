import { describe, expect, it } from "vitest";
import { checkNickname, isNicknameValid, nicknameViolations, normalizeNickname } from "./nickname-policy";

describe("nickname policy", () => {
  it("accepts 2-20 letters/numbers, Korean or English", () => {
    expect(isNicknameValid("다붓이")).toBe(true);
    expect(isNicknameValid("Yong2")).toBe(true);
    expect(nicknameViolations("가나다라마바사아자차카타파하가나다라")).toEqual([]);
  });

  it("trims surrounding whitespace before checking length", () => {
    expect(isNicknameValid("  다붓  ")).toBe(true);
    expect(normalizeNickname("  다붓  ")).toBe("다붓");
  });

  it("rejects fewer than 2 characters", () => {
    expect(nicknameViolations("a")).toEqual(["tooShort"]);
    expect(nicknameViolations("")).toEqual(["tooShort"]);
  });

  it("rejects more than 20 characters", () => {
    expect(nicknameViolations("a".repeat(21))).toEqual(["tooLong"]);
  });

  it("rejects spaces and symbols", () => {
    expect(nicknameViolations("hi there")).toEqual(["invalidChars"]);
    expect(nicknameViolations("닉네임!")).toEqual(["invalidChars"]);
  });

  it("reports every failing rule in order", () => {
    expect(nicknameViolations("a!".repeat(11))).toEqual(["tooLong", "invalidChars"]);
  });

  it("returns a per-rule map for live hints", () => {
    expect(checkNickname("a")).toEqual({ tooShort: false, tooLong: true, invalidChars: true });
  });
});

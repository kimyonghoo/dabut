import { describe, it, expect } from "vitest";
import { parseWon, formatWonPreview, MAX_WON } from "./parse-won";

describe("parseWon", () => {
  it("parses plain won and separators", () => {
    expect(parseWon("2000000")).toEqual({ value: 2_000_000 });
    expect(parseWon("2,000,000원")).toEqual({ value: 2_000_000 });
  });
  it("parses Korean unit shorthand", () => {
    expect(parseWon("200만")).toEqual({ value: 2_000_000 });
    expect(parseWon("2.5만")).toEqual({ value: 25_000 });
    expect(parseWon("1억")).toEqual({ value: 100_000_000 });
    expect(parseWon("1억 5천만")).toEqual({ value: 150_000_000 });
    expect(parseWon("5천")).toEqual({ value: 5_000 });
  });
  it("treats empty as clearing", () => {
    expect(parseWon("  ")).toEqual({ value: null });
  });
  it("rejects garbage and out-of-range", () => {
    expect(parseWon("abc")).toEqual({ error: "invalid" });
    expect(parseWon("-5")).toEqual({ error: "invalid" });
    expect(parseWon(String(MAX_WON + 1))).toEqual({ error: "invalid" });
    expect(parseWon("200억")).toEqual({ error: "invalid" });
  });
});

describe("formatWonPreview", () => {
  it("adds a 만 shorthand when round", () => {
    expect(formatWonPreview(2_000_000)).toBe("2,000,000원 (200만원)");
    expect(formatWonPreview(1_234_567)).toBe("1,234,567원");
  });
});

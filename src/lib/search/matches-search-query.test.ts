import { describe, it, expect } from "vitest";
import { matchesSearchQuery } from "./matches-search-query";

describe("matchesSearchQuery", () => {
  it("matches everything for an empty or whitespace-only query", () => {
    expect(matchesSearchQuery("", "Coffee")).toBe(true);
    expect(matchesSearchQuery("   ", "Coffee")).toBe(true);
    expect(matchesSearchQuery("", null, undefined)).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(matchesSearchQuery("coffee", "Morning Coffee")).toBe(true);
    expect(matchesSearchQuery("COFFEE", "morning coffee")).toBe(true);
    expect(matchesSearchQuery("커피", "아침 커피")).toBe(true);
  });

  it("matches if any of multiple fields contains the query", () => {
    expect(matchesSearchQuery("food", null, "Food & Drink")).toBe(true);
    expect(matchesSearchQuery("rent", "Coffee", "Food")).toBe(false);
  });

  it("treats null/undefined fields as empty rather than skipping them", () => {
    expect(matchesSearchQuery("x", null, undefined)).toBe(false);
  });

  it("does not match when the query isn't found in any field", () => {
    expect(matchesSearchQuery("zzz", "Coffee", "Food")).toBe(false);
  });
});

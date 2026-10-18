import { describe, it, expect } from "vitest";
import { categoryIconKey, formatWon } from "./category-icon";

describe("categoryIconKey", () => {
  it("prefers a stored lucide key", () => {
    expect(categoryIconKey({ name: "식비", icon: "coffee" })).toBe("coffee");
  });
  it("maps legacy emoji icons to keys", () => {
    expect(categoryIconKey({ name: "x", icon: "🐶" })).toBe("dog");
    expect(categoryIconKey("식비", "☕")).toBe("coffee");
  });
  it("falls back to the name map, then the default", () => {
    expect(categoryIconKey({ name: "월급", icon: null })).toBe("banknote");
    expect(categoryIconKey({ name: "육아", icon: "  " })).toBe("baby");
    expect(categoryIconKey("새 카테고리")).toBe("coins");
    expect(categoryIconKey(null)).toBe("coins");
  });
  it("ignores unknown stored icons", () => {
    expect(categoryIconKey({ name: "식비", icon: "nope" })).toBe("utensils");
  });
});

describe("formatWon", () => {
  it("formats with commas", () => {
    expect(formatWon(-15000)).toBe("15,000원");
  });
});

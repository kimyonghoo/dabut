import { describe, expect, it } from "vitest";
import { categoryEmoji } from "./category-emoji";

describe("categoryEmoji", () => {
  it("prefers the category's own icon", () => {
    expect(categoryEmoji({ name: "식비", icon: "☕" })).toBe("☕");
    expect(categoryEmoji("식비", "🐶")).toBe("🐶");
  });

  it("falls back to the built-in name map", () => {
    expect(categoryEmoji({ name: "식비", icon: null })).toBe("🍚");
    expect(categoryEmoji("월급")).toBe("💰");
    expect(categoryEmoji({ name: "육아", icon: "  " })).toBe("🍼");
  });

  it("falls back to 💸", () => {
    expect(categoryEmoji("새 카테고리")).toBe("💸");
    expect(categoryEmoji(null)).toBe("💸");
    expect(categoryEmoji(undefined)).toBe("💸");
    expect(categoryEmoji({ name: null })).toBe("💸");
  });
});

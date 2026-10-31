import { describe, expect, it } from "vitest";
import { suggestCategory } from "./suggest-category";

const h = [
  { memo: "스타벅스 아메리카노", categoryId: "cafe", type: "expense" },
  { memo: "점심 김밥", categoryId: "eat", type: "expense" },
  { memo: "점심 김밥", categoryId: "eat", type: "expense" },
  { memo: "월급", categoryId: "salary", type: "income" },
];

describe("suggestCategory", () => {
  it("returns null for short or unmatched text", () => {
    expect(suggestCategory("a", h, "expense")).toBeNull();
    expect(suggestCategory("택시", h, "expense")).toBeNull();
  });
  it("matches by containment, ignoring spaces and case", () => {
    expect(suggestCategory("스타벅스", h, "expense")).toBe("cafe");
    expect(suggestCategory("점심김밥 두줄", h, "expense")).toBe("eat");
  });
  it("only considers the same type", () => {
    expect(suggestCategory("월급", h, "expense")).toBeNull();
    expect(suggestCategory("월급", h, "income")).toBe("salary");
  });
  it("prefers exact matches over partial", () => {
    const hist = [
      { memo: "커피", categoryId: "cafe", type: "expense" },
      { memo: "커피 원두 구매", categoryId: "mart", type: "expense" },
      { memo: "커피 원두 구매", categoryId: "mart", type: "expense" },
    ];
    expect(suggestCategory("커피", hist, "expense")).toBe("cafe");
  });
});

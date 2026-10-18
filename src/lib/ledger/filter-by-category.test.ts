import { describe, it, expect } from "vitest";
import { filterByCategory, groupByOccurredAt } from "./filter-by-category";

const rows = [
  { id: "1", categoryId: "food", occurredAt: "2026-10-01" },
  { id: "2", categoryId: "salary", occurredAt: "2026-10-03" },
  { id: "3", categoryId: "food", occurredAt: "2026-10-03" },
  { id: "4", categoryId: "custom", occurredAt: "2026-10-02" },
];

describe("filterByCategory", () => {
  it("returns everything for null (All)", () => {
    expect(filterByCategory(rows, null)).toEqual(rows);
  });

  it("keeps only the selected category, including custom ones", () => {
    expect(filterByCategory(rows, "food").map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterByCategory(rows, "custom").map((r) => r.id)).toEqual(["4"]);
  });

  it("returns an empty list for a category with no rows", () => {
    expect(filterByCategory(rows, "none")).toEqual([]);
  });
});

describe("groupByOccurredAt", () => {
  it("groups by day, newest first", () => {
    const groups = groupByOccurredAt(rows);
    expect(groups.map((g) => g.date)).toEqual(["2026-10-03", "2026-10-02", "2026-10-01"]);
    expect(groups[0].items.map((r) => r.id)).toEqual(["2", "3"]);
  });
});

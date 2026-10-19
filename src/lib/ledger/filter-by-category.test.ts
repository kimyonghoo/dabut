import { describe, it, expect } from "vitest";
import { filterByCategory, filterByOwner, filterByPaymentMethod, filterBySearch, groupByOccurredAt } from "./filter-by-category";

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

describe("filterByPaymentMethod", () => {
  const pmRows = [
    { id: "1", paymentMethodId: "card-a" },
    { id: "2", paymentMethodId: "card-b" },
    { id: "3", paymentMethodId: null },
    { id: "4", paymentMethodId: "card-a" },
  ];

  it("returns everything for null (All)", () => {
    expect(filterByPaymentMethod(pmRows, null)).toEqual(pmRows);
  });

  it("keeps only rows tagged with the selected method", () => {
    expect(filterByPaymentMethod(pmRows, "card-a").map((r) => r.id)).toEqual(["1", "4"]);
  });

  it("never matches an untagged row against a specific method", () => {
    expect(filterByPaymentMethod(pmRows, "card-a").some((r) => r.id === "3")).toBe(false);
    expect(filterByPaymentMethod(pmRows, "card-b").map((r) => r.id)).toEqual(["2"]);
  });
});

describe("filterByOwner", () => {
  const ownerRows = [
    { id: "1", ownerId: "me" },
    { id: "2", ownerId: "partner" },
    { id: "3", ownerId: "me" },
  ];

  it("returns everything for null (All)", () => {
    expect(filterByOwner(ownerRows, null, "me")).toEqual(ownerRows);
  });

  it("keeps only the current user's rows for 'mine'", () => {
    expect(filterByOwner(ownerRows, "mine", "me").map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("keeps only the other owner's rows for 'partner'", () => {
    expect(filterByOwner(ownerRows, "partner", "me").map((r) => r.id)).toEqual(["2"]);
  });
});

describe("filterBySearch", () => {
  const searchRows = [
    { id: "1", memo: "Morning coffee", category: { name: "Food" } },
    { id: "2", memo: null, category: { name: "Salary" } },
    { id: "3", memo: "Bus fare", category: { name: "Transport" } },
    { id: "4", memo: "Cafe", category: null },
  ];

  it("returns everything for an empty query", () => {
    expect(filterBySearch(searchRows, "")).toEqual(searchRows);
    expect(filterBySearch(searchRows, "   ")).toEqual(searchRows);
  });

  it("matches memo text case-insensitively", () => {
    expect(filterBySearch(searchRows, "coffee").map((r) => r.id)).toEqual(["1"]);
  });

  it("matches category name as well as memo", () => {
    expect(filterBySearch(searchRows, "salary").map((r) => r.id)).toEqual(["2"]);
  });

  it("handles rows with a null memo or null category gracefully", () => {
    expect(filterBySearch(searchRows, "transport").map((r) => r.id)).toEqual(["3"]);
    expect(filterBySearch(searchRows, "cafe").map((r) => r.id)).toEqual(["4"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterBySearch(searchRows, "zzz")).toEqual([]);
  });
});

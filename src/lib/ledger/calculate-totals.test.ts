import { describe, it, expect } from "vitest";
import { calculateMonthlyTotals } from "./calculate-totals";

describe("calculateMonthlyTotals", () => {
  it("sums income and expense separately and computes net", () => {
    const totals = calculateMonthlyTotals([
      { type: "income", amount: 3000000 },
      { type: "expense", amount: 50000 },
      { type: "expense", amount: 12000 },
    ]);
    expect(totals).toEqual({ income: 3000000, expense: 62000, net: 2938000 });
  });
  it("returns zeros for an empty list", () => {
    expect(calculateMonthlyTotals([])).toEqual({ income: 0, expense: 0, net: 0 });
  });
});

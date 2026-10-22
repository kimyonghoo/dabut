import { describe, it, expect } from "vitest";
import {
  rangeBounds,
  computeSavingsRate,
  computeCategoryShare,
  computePaymentMethodShare,
  computeMonthlyTrend,
  computeWeekdayPattern,
  computeTopExpenses,
  computeEngelIndex,
  engelBand,
  type StatsTransaction,
} from "./stats";

function tx(overrides: Partial<StatsTransaction>): StatsTransaction {
  return {
    type: "expense",
    amount: 0,
    occurredAt: "2026-10-01",
    categoryId: "cat-1",
    categoryName: "외식",
    categoryIcon: "utensils",
    paymentMethodId: null,
    paymentMethodName: null,
    memo: null,
    ...overrides,
  };
}

describe("rangeBounds", () => {
  it("covers only the current month for 'month'", () => {
    expect(rangeBounds("month", new Date(2026, 9, 21))).toEqual({ start: "2026-10-01", end: "2026-10-21" });
  });
  it("covers the last 3 calendar months (inclusive of current) for '3m'", () => {
    expect(rangeBounds("3m", new Date(2026, 9, 21))).toEqual({ start: "2026-08-01", end: "2026-10-21" });
  });
});

describe("computeSavingsRate", () => {
  it("computes (income - expense) / income * 100", () => {
    const transactions = [
      tx({ type: "income", amount: 4000000, occurredAt: "2026-10-05" }),
      tx({ type: "expense", amount: 2800000, occurredAt: "2026-10-10" }),
    ];
    const result = computeSavingsRate(transactions, "2026-10-01", "2026-10-31");
    expect(result).toEqual({ income: 4000000, expense: 2800000, saved: 1200000, ratePct: 30 });
  });

  it("returns a null rate when there's no income to divide by", () => {
    const result = computeSavingsRate([tx({ type: "expense", amount: 5000 })], "2026-10-01", "2026-10-31");
    expect(result.ratePct).toBeNull();
  });

  it("ignores transactions outside the range", () => {
    const transactions = [
      tx({ type: "income", amount: 1000, occurredAt: "2026-09-30" }),
      tx({ type: "income", amount: 2000, occurredAt: "2026-10-05" }),
    ];
    const result = computeSavingsRate(transactions, "2026-10-01", "2026-10-31");
    expect(result.income).toBe(2000);
  });
});

describe("computeCategoryShare", () => {
  it("sorts descending and computes percentage of total expense", () => {
    const transactions = [
      tx({ categoryId: "c1", categoryName: "외식", amount: 60000 }),
      tx({ categoryId: "c2", categoryName: "쇼핑", amount: 40000 }),
      tx({ type: "income", categoryId: "c3", categoryName: "월급", amount: 999999 }),
    ];
    const result = computeCategoryShare(transactions, "2026-10-01", "2026-10-31", "기타");
    expect(result).toEqual([
      { id: "c1", name: "외식", icon: "utensils", amount: 60000, pct: 60 },
      { id: "c2", name: "쇼핑", icon: "utensils", amount: 40000, pct: 40 },
    ]);
  });

  it("folds everything past the top 5 into an 기타 bucket", () => {
    const transactions = Array.from({ length: 7 }, (_, i) =>
      tx({ categoryId: `c${i}`, categoryName: `cat${i}`, amount: (7 - i) * 1000 })
    );
    const result = computeCategoryShare(transactions, "2026-10-01", "2026-10-31", "기타");
    expect(result).toHaveLength(6);
    expect(result[5].name).toBe("기타 (2)");
    expect(result[5].amount).toBe(1000 + 2000);
  });

  it("returns an empty list when there's no expense in range", () => {
    expect(computeCategoryShare([], "2026-10-01", "2026-10-31", "기타")).toEqual([]);
  });
});

describe("computePaymentMethodShare", () => {
  it("groups missing payment methods under the unassigned label", () => {
    const transactions = [
      tx({ paymentMethodId: "pm1", paymentMethodName: "신한카드", amount: 30000 }),
      tx({ paymentMethodId: null, amount: 10000 }),
    ];
    const result = computePaymentMethodShare(transactions, "2026-10-01", "2026-10-31", "미지정");
    expect(result).toEqual([
      { id: "pm1", name: "신한카드", icon: null, amount: 30000, pct: 75 },
      { id: "__none__", name: "미지정", icon: null, amount: 10000, pct: 25 },
    ]);
  });
});

describe("computeMonthlyTrend", () => {
  it("returns oldest-first totals for the requested number of months", () => {
    const transactions = [
      tx({ type: "income", amount: 1000, occurredAt: "2026-09-10" }),
      tx({ type: "expense", amount: 400, occurredAt: "2026-09-15" }),
      tx({ type: "income", amount: 2000, occurredAt: "2026-10-01" }),
    ];
    const result = computeMonthlyTrend(transactions, 2, new Date(2026, 9, 21));
    expect(result).toEqual([
      { monthKey: "2026-09", income: 1000, expense: 400, net: 600 },
      { monthKey: "2026-10", income: 2000, expense: 0, net: 2000 },
    ]);
  });
});

describe("computeWeekdayPattern", () => {
  it("buckets expense totals by local day-of-week", () => {
    // 2026-10-19 is a Monday, 2026-10-20 a Tuesday.
    const transactions = [
      tx({ occurredAt: "2026-10-19", amount: 1000 }),
      tx({ occurredAt: "2026-10-19", amount: 500 }),
      tx({ occurredAt: "2026-10-20", amount: 2000 }),
    ];
    const result = computeWeekdayPattern(transactions, "2026-10-01", "2026-10-31");
    expect(result[1].amount).toBe(1500); // Monday
    expect(result[2].amount).toBe(2000); // Tuesday
    expect(result[0].amount).toBe(0); // Sunday
  });
});

describe("computeTopExpenses", () => {
  it("sorts descending and falls back to category name when there's no memo", () => {
    const transactions = [
      tx({ amount: 5000, memo: "커피", occurredAt: "2026-10-01" }),
      tx({ amount: 50000, memo: null, categoryName: "쇼핑", occurredAt: "2026-10-02" }),
    ];
    const result = computeTopExpenses(transactions, "2026-10-01", "2026-10-31");
    expect(result[0]).toMatchObject({ label: "쇼핑", amount: 50000 });
    expect(result[1]).toMatchObject({ label: "커피", amount: 5000 });
  });

  it("caps at the requested limit", () => {
    const transactions = Array.from({ length: 15 }, (_, i) => tx({ amount: i + 1 }));
    expect(computeTopExpenses(transactions, "2026-10-01", "2026-10-31", 10)).toHaveLength(10);
  });
});

describe("computeEngelIndex", () => {
  const mk = (categoryName: string, amount: number) => tx({ categoryName, amount, type: "expense" });
  it("sums 외식/마트/배달/편의점 over total expense", () => {
    const r = computeEngelIndex(
      [mk("외식", 10000), mk("마트", 10000), mk("배달", 5000), mk("편의점", 5000), mk("교통", 70000)],
      "2000-01-01",
      "2999-12-31"
    );
    expect(r.pct).toBe(30);
    expect(r.band).toBe("high");
  });
  it("returns null pct with no expense", () => {
    expect(computeEngelIndex([], "2000-01-01", "2999-12-31").pct).toBeNull();
  });
  it("band boundaries", () => {
    expect(engelBand(19.9)).toBe("veryLow");
    expect(engelBand(20)).toBe("low");
    expect(engelBand(25)).toBe("normal");
    expect(engelBand(35)).toBe("veryHigh");
  });
});

import { describe, it, expect } from "vitest";
import { getMonthGridDays } from "./month-grid";

describe("getMonthGridDays", () => {
  it("returns a multiple of 7 days", () => {
    const days = getMonthGridDays(new Date(2026, 9, 1)); // October 2026
    expect(days.length % 7).toBe(0);
  });
  it("starts on a Sunday and ends on a Saturday", () => {
    const days = getMonthGridDays(new Date(2026, 9, 1));
    expect(days[0].getDay()).toBe(0);
    expect(days[days.length - 1].getDay()).toBe(6);
  });
  it("covers every day of the given month", () => {
    const days = getMonthGridDays(new Date(2026, 9, 1));
    const oct1 = days.find((d) => d.getFullYear() === 2026 && d.getMonth() === 9 && d.getDate() === 1);
    const oct31 = days.find((d) => d.getFullYear() === 2026 && d.getMonth() === 9 && d.getDate() === 31);
    expect(oct1).toBeDefined();
    expect(oct31).toBeDefined();
  });
});

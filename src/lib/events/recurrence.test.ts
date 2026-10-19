import { describe, it, expect } from "vitest";
import { expandRecurringEvent, defaultExpansionWindow, type RecurrenceRule, type RecurringSourceEvent } from "./recurrence";
import { zonedDateParts } from "@/lib/dates/timezone";

const TZ = "Asia/Seoul";

function occurrenceDates(occurrences: ReturnType<typeof expandRecurringEvent>): string[] {
  return occurrences.map((o) => o.occurrenceDate);
}

describe("expandRecurringEvent", () => {
  describe("daily", () => {
    const parent: RecurringSourceEvent = {
      id: "p1",
      start_at: "2026-01-01T00:00:00.000Z", // 09:00 KST
      end_at: "2026-01-01T01:00:00.000Z", // 10:00 KST
      all_day: false,
    };
    const rule: RecurrenceRule = { freq: "daily", interval: 1, endType: "never" };

    it("generates one occurrence per day at interval 1", () => {
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-01-05" }, TZ);
      expect(occurrenceDates(result)).toEqual([
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
      ]);
    });

    it("preserves the time-of-day (09:00-10:00 KST) on every occurrence", () => {
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-01-03" }, TZ);
      for (const occ of result) {
        expect(zonedDateParts(occ.start_at, TZ)).toMatchObject({ hour: 9, minute: 0 });
        expect(zonedDateParts(occ.end_at!, TZ)).toMatchObject({ hour: 10, minute: 0 });
      }
    });

    it("supports a custom interval (every 3 days)", () => {
      const customRule: RecurrenceRule = { freq: "daily", interval: 3, endType: "never" };
      const result = expandRecurringEvent(parent, customRule, { start: "2026-01-01", end: "2026-01-12" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2026-01-01", "2026-01-04", "2026-01-07", "2026-01-10"]);
    });

    it("does not generate occurrences before the series' own start", () => {
      const result = expandRecurringEvent(parent, rule, { start: "2025-12-25", end: "2026-01-02" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2026-01-01", "2026-01-02"]);
    });
  });

  describe("weekly", () => {
    const parent: RecurringSourceEvent = {
      id: "p1",
      start_at: "2026-01-05T10:00:00.000Z", // Mon 2026-01-05, 19:00 KST
      end_at: null,
      all_day: false,
    };

    it("generates one occurrence per week at interval 1", () => {
      const rule: RecurrenceRule = { freq: "weekly", interval: 1, endType: "never" };
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-02-01" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]);
    });

    it("supports a custom interval (every 2 weeks)", () => {
      const rule: RecurrenceRule = { freq: "weekly", interval: 2, endType: "never" };
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-03-01" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2026-01-05", "2026-01-19", "2026-02-02", "2026-02-16"]);
    });
  });

  describe("monthly", () => {
    it("generates one occurrence per month at interval 1", () => {
      const parent: RecurringSourceEvent = { id: "p1", start_at: "2026-01-15T00:00:00.000Z", end_at: null, all_day: true };
      const rule: RecurrenceRule = { freq: "monthly", interval: 1, endType: "never" };
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-06-01" }, TZ);
      expect(occurrenceDates(result)).toEqual([
        "2026-01-15",
        "2026-02-15",
        "2026-03-15",
        "2026-04-15",
        "2026-05-15",
      ]);
    });

    it("supports a custom interval (every 2 months)", () => {
      const parent: RecurringSourceEvent = { id: "p1", start_at: "2026-01-15T00:00:00.000Z", end_at: null, all_day: true };
      const rule: RecurrenceRule = { freq: "monthly", interval: 2, endType: "never" };
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-07-01" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2026-01-15", "2026-03-15", "2026-05-15"]);
    });

    it("clamps 'every month on the 31st' to the shorter month's last day", () => {
      // 2026-01-31 recurring monthly: Feb has 28 days (2026 not a leap year),
      // Apr/Jun have 30 — Samsung/Google clamp to the month's last day rather
      // than skip the month or roll into the next one.
      const parent: RecurringSourceEvent = { id: "p1", start_at: "2026-01-31T00:00:00.000Z", end_at: null, all_day: true };
      const rule: RecurrenceRule = { freq: "monthly", interval: 1, endType: "never" };
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-06-30" }, TZ);
      expect(occurrenceDates(result)).toEqual([
        "2026-01-31",
        "2026-02-28",
        "2026-03-31",
        "2026-04-30",
        "2026-05-31",
        "2026-06-30",
      ]);
    });
  });

  describe("yearly", () => {
    it("generates one occurrence per year at interval 1", () => {
      const parent: RecurringSourceEvent = { id: "p1", start_at: "2024-03-10T00:00:00.000Z", end_at: null, all_day: true };
      const rule: RecurrenceRule = { freq: "yearly", interval: 1, endType: "never" };
      const result = expandRecurringEvent(parent, rule, { start: "2024-01-01", end: "2028-01-01" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2024-03-10", "2025-03-10", "2026-03-10", "2027-03-10"]);
    });

    it("supports a custom interval (every 3 years)", () => {
      const parent: RecurringSourceEvent = { id: "p1", start_at: "2024-03-10T00:00:00.000Z", end_at: null, all_day: true };
      const rule: RecurrenceRule = { freq: "yearly", interval: 3, endType: "never" };
      const result = expandRecurringEvent(parent, rule, { start: "2024-01-01", end: "2032-01-01" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2024-03-10", "2027-03-10", "2030-03-10"]);
    });

    it("clamps a Feb 29 birthday to Feb 28 in non-leap years", () => {
      const parent: RecurringSourceEvent = { id: "p1", start_at: "2024-02-29T00:00:00.000Z", end_at: null, all_day: true };
      const rule: RecurrenceRule = { freq: "yearly", interval: 1, endType: "never" };
      const result = expandRecurringEvent(parent, rule, { start: "2024-01-01", end: "2029-01-01" }, TZ);
      expect(occurrenceDates(result)).toEqual([
        "2024-02-29",
        "2025-02-28",
        "2026-02-28",
        "2027-02-28",
        "2028-02-29",
      ]);
    });
  });

  describe("end conditions", () => {
    const parent: RecurringSourceEvent = { id: "p1", start_at: "2026-01-01T00:00:00.000Z", end_at: null, all_day: true };

    it("'never' generates correctly up to a reasonable cap, not truly infinitely", () => {
      const rule: RecurrenceRule = { freq: "daily", interval: 1, endType: "never" };
      // Ask for a window far beyond the documented 10-year horizon cap.
      const result = expandRecurringEvent(parent, rule, { start: "2040-01-01", end: "2040-01-05" }, TZ);
      expect(result).toEqual([]);
      // But within the horizon, it keeps generating normally.
      const withinHorizon = expandRecurringEvent(parent, rule, { start: "2035-12-30", end: "2036-01-02" }, TZ);
      expect(occurrenceDates(withinHorizon)).toEqual(["2035-12-30", "2035-12-31", "2036-01-01"]);
    });

    it("'until' stops generating after the end date (inclusive)", () => {
      const rule: RecurrenceRule = { freq: "daily", interval: 1, endType: "until", until: "2026-01-05" };
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-01-10" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]);
    });

    it("'count' stops generating after N occurrences", () => {
      const rule: RecurrenceRule = { freq: "daily", interval: 1, endType: "count", count: 3 };
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-01-10" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    });

    it("'count' interacts correctly with a custom interval", () => {
      const rule: RecurrenceRule = { freq: "weekly", interval: 2, endType: "count", count: 3 };
      const result = expandRecurringEvent(parent, rule, { start: "2026-01-01", end: "2026-12-31" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2026-01-01", "2026-01-15", "2026-01-29"]);
    });
  });

  describe("exceptions", () => {
    const parent: RecurringSourceEvent = { id: "p1", start_at: "2026-01-01T00:00:00.000Z", end_at: null, all_day: true };
    const rule: RecurrenceRule = { freq: "daily", interval: 1, endType: "never" };

    it("a cancelled exception removes just that one instance", () => {
      const result = expandRecurringEvent(
        parent,
        rule,
        { start: "2026-01-01", end: "2026-01-05" },
        TZ,
        new Set(["2026-01-03"])
      );
      expect(occurrenceDates(result)).toEqual(["2026-01-01", "2026-01-02", "2026-01-04", "2026-01-05"]);
    });

    it("a modified exception's date is also skipped (the detached event is shown in its place by the caller)", () => {
      const result = expandRecurringEvent(
        parent,
        rule,
        { start: "2026-01-01", end: "2026-01-05" },
        TZ,
        new Set(["2026-01-02", "2026-01-04"])
      );
      expect(occurrenceDates(result)).toEqual(["2026-01-01", "2026-01-03", "2026-01-05"]);
    });
  });

  describe("DST wall-clock preservation", () => {
    it("a daily 9am America/New_York event stays 9am local across the US DST boundary", () => {
      // US DST started 2026-03-08 (EST -05:00 -> EDT -04:00).
      const parent: RecurringSourceEvent = {
        id: "p1",
        start_at: "2026-03-01T14:00:00.000Z", // 09:00 EST
        end_at: "2026-03-01T15:00:00.000Z", // 10:00 EST
        all_day: false,
      };
      const rule: RecurrenceRule = { freq: "daily", interval: 1, endType: "never" };
      const result = expandRecurringEvent(
        parent,
        rule,
        { start: "2026-03-01", end: "2026-03-15" },
        "America/New_York"
      );
      expect(result.length).toBe(15);
      for (const occ of result) {
        expect(zonedDateParts(occ.start_at, "America/New_York")).toMatchObject({ hour: 9, minute: 0 });
        expect(zonedDateParts(occ.end_at!, "America/New_York")).toMatchObject({ hour: 10, minute: 0 });
      }
      // Before the boundary: 09:00 EST = 14:00Z. After: 09:00 EDT = 13:00Z.
      const before = result.find((o) => o.occurrenceDate === "2026-03-07")!;
      const after = result.find((o) => o.occurrenceDate === "2026-03-09")!;
      expect(before.start_at).toBe("2026-03-07T14:00:00.000Z");
      expect(after.start_at).toBe("2026-03-09T13:00:00.000Z");
    });
  });

  describe("multi-day / overnight span", () => {
    it("keeps the same day-span on every occurrence of a recurring overnight event", () => {
      // 23:00 KST -> 01:00 KST next day, recurring daily.
      const overnight: RecurringSourceEvent = {
        id: "p2",
        start_at: "2026-01-01T14:00:00.000Z", // 23:00 KST, 2026-01-01
        end_at: "2026-01-01T16:00:00.000Z", // 01:00 KST, 2026-01-02
        all_day: false,
      };
      const rule: RecurrenceRule = { freq: "daily", interval: 1, endType: "never" };
      const result = expandRecurringEvent(overnight, rule, { start: "2026-01-01", end: "2026-01-02" }, TZ);
      expect(occurrenceDates(result)).toEqual(["2026-01-01", "2026-01-02"]);
      const first = result[0];
      expect(zonedDateParts(first.start_at, TZ)).toMatchObject({ year: 2026, month: 1, day: 1, hour: 23 });
      expect(zonedDateParts(first.end_at!, TZ)).toMatchObject({ year: 2026, month: 1, day: 2, hour: 1 });
      const second = result[1];
      expect(zonedDateParts(second.start_at, TZ)).toMatchObject({ year: 2026, month: 1, day: 2, hour: 23 });
      expect(zonedDateParts(second.end_at!, TZ)).toMatchObject({ year: 2026, month: 1, day: 3, hour: 1 });
    });
  });
});

describe("defaultExpansionWindow", () => {
  it("spans 1 year back to 3 years forward from today, in the given timezone", () => {
    const window = defaultExpansionWindow("2026-06-15T00:00:00.000Z", TZ);
    expect(window).toEqual({ start: "2025-06-15", end: "2029-06-15" });
  });
});

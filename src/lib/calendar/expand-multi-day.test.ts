import { describe, expect, it } from "vitest";
import { expandEventsByDay } from "./expand-multi-day";

const base = { all_day: false };

describe("expandEventsByDay", () => {
  it("keeps a single-day event as one single entry", () => {
    const e = { id: "a", ...base, start_at: "2026-10-22T09:00:00Z", end_at: "2026-10-22T10:00:00Z" };
    expect(expandEventsByDay([e], "UTC")).toEqual([{ date: "2026-10-22", event: e, dayPart: "single", endsAtMidnight: false }]);
  });

  it("treats a missing end_at as single", () => {
    const e = { id: "a", ...base, start_at: "2026-10-22T09:00:00Z", end_at: null };
    expect(expandEventsByDay([e], "UTC").map((x) => x.dayPart)).toEqual(["single"]);
  });

  it("expands a timed multi-day event into first/middle/last", () => {
    const e = { id: "a", ...base, start_at: "2026-10-22T20:00:00Z", end_at: "2026-10-25T08:00:00Z" };
    const r = expandEventsByDay([e], "UTC");
    expect(r.map((x) => [x.date, x.dayPart])).toEqual([
      ["2026-10-22", "first"],
      ["2026-10-23", "middle"],
      ["2026-10-24", "middle"],
      ["2026-10-25", "last"],
    ]);
    expect(r.every((x) => x.event === e)).toBe(true);
  });

  it("uses the given timezone for day boundaries", () => {
    // 20:00 KST Oct 22 -> 08:00 KST Oct 25
    const e = { id: "a", ...base, start_at: "2026-10-22T11:00:00Z", end_at: "2026-10-24T23:00:00Z" };
    expect(expandEventsByDay([e], "Asia/Seoul").map((x) => x.date)).toEqual([
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("expands all-day date ranges", () => {
    const e = { id: "a", all_day: true, start_at: "2026-10-22T00:00:00Z", end_at: "2026-10-24T00:00:00Z" };
    expect(expandEventsByDay([e], "UTC").map((x) => x.dayPart)).toEqual(["first", "middle", "last"]);
  });

  it("ends on the previous day (~24:00) when a timed event ends at 00:00 of a later day", () => {
    const e = { id: "a", ...base, start_at: "2026-10-22T20:00:00Z", end_at: "2026-10-24T00:00:00Z" };
    const r = expandEventsByDay([e], "UTC");
    expect(r.map((x) => [x.date, x.dayPart, x.endsAtMidnight])).toEqual([
      ["2026-10-22", "first", false],
      ["2026-10-23", "last", true],
    ]);
  });

  it("stays single when it only runs to midnight of the next day", () => {
    const e = { id: "a", ...base, start_at: "2026-10-22T20:00:00Z", end_at: "2026-10-23T00:00:00Z" };
    expect(expandEventsByDay([e], "UTC").map((x) => [x.date, x.dayPart])).toEqual([["2026-10-22", "single"]]);
  });

  it("passes virtual occurrence ids through", () => {
    const e = { id: "p__2026-10-22", ...base, start_at: "2026-10-22T20:00:00Z", end_at: "2026-10-23T08:00:00Z" };
    expect(expandEventsByDay([e], "UTC").map((x) => x.event.id)).toEqual(["p__2026-10-22", "p__2026-10-22"]);
  });
});

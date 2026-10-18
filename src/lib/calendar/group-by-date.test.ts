import { describe, it, expect } from "vitest";
import { groupEventsByDate } from "./group-by-date";

describe("groupEventsByDate", () => {
  it("groups events by their start_at calendar date, sorted ascending", () => {
    const events = [
      { id: "c", start_at: "2026-10-16T09:00:00Z" },
      { id: "a", start_at: "2026-10-15T08:00:00Z" },
      { id: "b", start_at: "2026-10-15T20:00:00Z" },
    ];
    const grouped = groupEventsByDate(events, "UTC");
    expect(grouped.map((g) => g.date)).toEqual(["2026-10-15", "2026-10-16"]);
    expect(grouped[0].events.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("groups by the given timezone's calendar day, not UTC's", () => {
    // 2026-10-15T23:00:00Z is already 2026-10-16 in Asia/Seoul (UTC+9).
    const events = [{ id: "a", start_at: "2026-10-15T23:00:00Z" }];
    expect(groupEventsByDate(events, "UTC").map((g) => g.date)).toEqual(["2026-10-15"]);
    expect(groupEventsByDate(events, "Asia/Seoul").map((g) => g.date)).toEqual(["2026-10-16"]);
  });
});

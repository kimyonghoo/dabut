import { describe, it, expect } from "vitest";
import { groupEventsByDate } from "./group-by-date";

describe("groupEventsByDate", () => {
  it("groups events by their start_at calendar date, sorted ascending", () => {
    const events = [
      { id: "c", start_at: "2026-10-16T09:00:00Z" },
      { id: "a", start_at: "2026-10-15T08:00:00Z" },
      { id: "b", start_at: "2026-10-15T20:00:00Z" },
    ];
    const grouped = groupEventsByDate(events);
    expect(grouped.map((g) => g.date)).toEqual(["2026-10-15", "2026-10-16"]);
    expect(grouped[0].events.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

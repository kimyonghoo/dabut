import { describe, expect, it } from "vitest";
import { getMonthGridDays } from "./month-grid";
import { assignLanes, computeMultiDaySegments, groupIntoWeeks } from "./multi-day-bars";

// October 2026's grid starts Sun 2026-09-27 and Oct 1 is a Thursday, so:
//   week 0: Sep27(Sun,0) Sep28(Mon,1) Sep29(Tue,2) Sep30(Wed,3) Oct1(Thu,4) Oct2(Fri,5) Oct3(Sat,6)
//   week 1: Oct4(Sun,0) Oct5(Mon,1) Oct6(Tue,2) ...
const OCT_2026 = new Date(2026, 9, 1);
const GRID = getMonthGridDays(OCT_2026);

describe("groupIntoWeeks", () => {
  it("splits a flat grid into chunks of 7", () => {
    const weeks = groupIntoWeeks(GRID);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.length * 7).toBe(GRID.length);
  });
});

describe("computeMultiDaySegments", () => {
  it("returns no segments for a same-day event", () => {
    const event = { start_at: "2026-10-01T09:00:00.000Z", end_at: "2026-10-01T10:00:00.000Z" };
    expect(computeMultiDaySegments(GRID, event, "UTC")).toEqual([]);
  });

  it("returns no segments for an all-day event with no end_at", () => {
    const event = { start_at: "2026-10-01T00:00:00.000Z", end_at: null };
    expect(computeMultiDaySegments(GRID, event, "UTC")).toEqual([]);
  });

  // Worked example from the spec: Thursday Oct 1 -> Monday Oct 5 splits into
  // Thu->Sat in week 0's row (cut off at the week boundary, no end cap) and
  // Sun->Mon in week 1's row (cut off at its start, rounded at its end).
  it("splits an event that crosses a week boundary into one segment per week", () => {
    const event = { start_at: "2026-10-01T09:00:00.000Z", end_at: "2026-10-05T18:00:00.000Z" };
    const segments = computeMultiDaySegments(GRID, event, "UTC");
    expect(segments).toEqual([
      { weekIndex: 0, startCol: 4, endCol: 6, isEventStart: true, isEventEnd: false },
      { weekIndex: 1, startCol: 0, endCol: 1, isEventStart: false, isEventEnd: true },
    ]);
  });

  it("produces a single segment for an event within one week", () => {
    const event = { start_at: "2026-09-28T09:00:00.000Z", end_at: "2026-09-30T18:00:00.000Z" };
    const segments = computeMultiDaySegments(GRID, event, "UTC");
    expect(segments).toEqual([{ weekIndex: 0, startCol: 1, endCol: 3, isEventStart: true, isEventEnd: true }]);
  });

  it("spans three weeks for a long event, with uncapped middle segments", () => {
    // Oct 1 (Thu, week 0) through Oct 10 (Sat, week 1 end)... use a longer
    // span that fully covers week 1: Oct 1 -> Oct 12 (Mon, week 2).
    const event = { start_at: "2026-10-01T09:00:00.000Z", end_at: "2026-10-12T18:00:00.000Z" };
    const segments = computeMultiDaySegments(GRID, event, "UTC");
    expect(segments).toEqual([
      { weekIndex: 0, startCol: 4, endCol: 6, isEventStart: true, isEventEnd: false },
      { weekIndex: 1, startCol: 0, endCol: 6, isEventStart: false, isEventEnd: false },
      { weekIndex: 2, startCol: 0, endCol: 1, isEventStart: false, isEventEnd: true },
    ]);
  });

  it("uses the viewing timezone to decide which calendar day the event lands on", () => {
    // 2026-09-28T20:00Z is Mon in UTC but Tue 05:00 in Asia/Seoul; similarly
    // the end instant is Wed in UTC but Thu 05:00 in Seoul. Same instants,
    // different day-of-week columns in each zone (both still within week 0).
    const event = { start_at: "2026-09-28T20:00:00.000Z", end_at: "2026-09-30T20:00:00.000Z" };
    const utcSegments = computeMultiDaySegments(GRID, event, "UTC");
    const seoulSegments = computeMultiDaySegments(GRID, event, "Asia/Seoul");
    expect(utcSegments).toEqual([{ weekIndex: 0, startCol: 1, endCol: 3, isEventStart: true, isEventEnd: true }]);
    expect(seoulSegments).toEqual([{ weekIndex: 0, startCol: 2, endCol: 4, isEventStart: true, isEventEnd: true }]);
  });

  it("ignores an event entirely outside the visible grid", () => {
    const event = { start_at: "2025-01-01T00:00:00.000Z", end_at: "2025-01-03T00:00:00.000Z" };
    expect(computeMultiDaySegments(GRID, event, "UTC")).toEqual([]);
  });
});

describe("assignLanes", () => {
  it("gives non-overlapping segments the same lane", () => {
    const items = [
      { startCol: 0, endCol: 1 },
      { startCol: 2, endCol: 3 },
    ];
    const laned = assignLanes(items);
    expect(laned.map((l) => l.lane)).toEqual([0, 0]);
  });

  it("stacks overlapping segments into separate lanes", () => {
    const a = { startCol: 0, endCol: 3 };
    const b = { startCol: 2, endCol: 5 };
    const laned = assignLanes([a, b]);
    const laneOf = (item: typeof a) => laned.find((l) => l.item === item)!.lane;
    expect(laneOf(a)).not.toBe(laneOf(b));
  });

  it("reuses a lane once its occupant has ended", () => {
    const a = { startCol: 0, endCol: 1 };
    const b = { startCol: 2, endCol: 3 }; // starts after a ends: same lane
    const c = { startCol: 0, endCol: 5 }; // overlaps a: different lane
    const laned = assignLanes([a, b, c]);
    const laneOf = (item: typeof a) => laned.find((l) => l.item === item)!.lane;
    expect(laneOf(a)).toBe(laneOf(b));
    expect(laneOf(c)).not.toBe(laneOf(a));
  });

  it("does not mutate the input array", () => {
    const items = [
      { startCol: 2, endCol: 3 },
      { startCol: 0, endCol: 1 },
    ];
    const copy = [...items];
    assignLanes(items);
    expect(items).toEqual(copy);
  });
});

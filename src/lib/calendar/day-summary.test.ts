import { describe, expect, it } from "vitest";
import { compareDayEvents, isDayWithinEvent, splitDayEvents, type DaySummaryEvent } from "./day-summary";

const ME = "me";
const PARTNER = "partner";

function ev(partial: Partial<DaySummaryEvent> & { id: string }): DaySummaryEvent {
  return {
    owner_id: ME,
    title: partial.id,
    all_day: false,
    start_at: "2026-10-18T09:00:00.000Z",
    end_at: "2026-10-18T10:00:00.000Z",
    visibility: "personal",
    ...partial,
  };
}

const DAY = new Date(2026, 9, 18); // TZ=UTC in vitest config

describe("isDayWithinEvent", () => {
  it("includes an event that starts that day", () => {
    expect(isDayWithinEvent(DAY, ev({ id: "a" }), "UTC")).toBe(true);
  });

  it("includes a multi-day event spanning the day", () => {
    expect(
      isDayWithinEvent(
        DAY,
        ev({ id: "a", start_at: "2026-10-16T00:00:00.000Z", end_at: "2026-10-20T00:00:00.000Z" }),
        "UTC"
      )
    ).toBe(true);
  });

  it("uses start as end when end_at is null", () => {
    expect(isDayWithinEvent(DAY, ev({ id: "a", start_at: "2026-10-17T00:00:00.000Z", end_at: null }), "UTC")).toBe(
      false
    );
    expect(isDayWithinEvent(DAY, ev({ id: "a", start_at: "2026-10-18T00:00:00.000Z", end_at: null }), "UTC")).toBe(
      true
    );
  });

  it("excludes events on other days", () => {
    expect(
      isDayWithinEvent(
        DAY,
        ev({ id: "a", start_at: "2026-10-19T09:00:00.000Z", end_at: "2026-10-19T10:00:00.000Z" }),
        "UTC"
      )
    ).toBe(false);
  });

  it("uses the given timezone's calendar day, not UTC's", () => {
    // 2026-10-18T01:00:00Z is still Oct 17 in Seoul... no: Seoul is UTC+9, so
    // 01:00 UTC is 10:00 KST the same day. Pick an instant that actually
    // crosses the boundary instead: 2026-10-17T16:00:00Z is 2026-10-18T01:00 KST.
    const event = ev({ id: "a", start_at: "2026-10-17T16:00:00.000Z", end_at: null });
    expect(isDayWithinEvent(DAY, event, "UTC")).toBe(false); // Oct 17 in UTC
    expect(isDayWithinEvent(DAY, event, "Asia/Seoul")).toBe(true); // Oct 18 in Seoul
  });
});

describe("compareDayEvents", () => {
  it("puts all-day events before timed events", () => {
    const allDay = ev({ id: "x", all_day: true, start_at: "2026-10-18T00:00:00.000Z", end_at: null });
    const early = ev({ id: "y", start_at: "2026-10-18T01:00:00.000Z" });
    expect(compareDayEvents(allDay, early)).toBeLessThan(0);
    expect(compareDayEvents(early, allDay)).toBeGreaterThan(0);
  });

  it("falls back to title when start times match", () => {
    expect(compareDayEvents(ev({ id: "1", title: "b" }), ev({ id: "2", title: "a" }))).toBeGreaterThan(0);
  });
});

describe("splitDayEvents", () => {
  const events = [
    ev({ id: "mine-late", start_at: "2026-10-18T15:00:00.000Z", end_at: "2026-10-18T16:00:00.000Z" }),
    ev({ id: "mine-early", start_at: "2026-10-18T08:00:00.000Z", end_at: "2026-10-18T09:00:00.000Z" }),
    ev({ id: "mine-allday", all_day: true, start_at: "2026-10-18T00:00:00.000Z", end_at: null }),
    ev({ id: "partner-1", owner_id: PARTNER, start_at: "2026-10-18T12:00:00.000Z", end_at: "2026-10-18T13:00:00.000Z" }),
    ev({ id: "partner-other-day", owner_id: PARTNER, start_at: "2026-10-20T12:00:00.000Z", end_at: null }),
    ev({ id: "mine-other-day", start_at: "2026-10-01T12:00:00.000Z", end_at: null }),
  ];

  it("splits the day's events by owner and sorts each section", () => {
    const { mine, partner } = splitDayEvents(events, DAY, ME, "UTC");
    expect(mine.map((e) => e.id)).toEqual(["mine-allday", "mine-early", "mine-late"]);
    expect(partner.map((e) => e.id)).toEqual(["partner-1"]);
  });

  it("returns empty sections when nothing is on that day", () => {
    expect(splitDayEvents(events, new Date(2026, 9, 25), ME, "UTC")).toEqual({ mine: [], partner: [], shared: [] });
  });

  it("does not mutate the input array", () => {
    const copy = [...events];
    splitDayEvents(events, DAY, ME, "UTC");
    expect(events).toEqual(copy);
  });

  it("puts each shared event once in `shared`, regardless of owner, and not in mine/partner", () => {
    const sharedByMe = ev({
      id: "shared-mine",
      visibility: "shared",
      start_at: "2026-10-18T11:00:00.000Z",
      end_at: "2026-10-18T12:00:00.000Z",
    });
    const sharedByPartner = ev({
      id: "shared-partner",
      owner_id: PARTNER,
      visibility: "shared",
      start_at: "2026-10-18T07:00:00.000Z",
      end_at: "2026-10-18T08:00:00.000Z",
    });
    const { mine, partner, shared } = splitDayEvents([sharedByMe, sharedByPartner], DAY, ME, "UTC");
    expect(mine).toEqual([]);
    expect(partner).toEqual([]);
    expect(shared.map((e) => e.id)).toEqual(["shared-partner", "shared-mine"]);
  });
});

import { describe, it, expect } from "vitest";
import { buildEventTimestamps } from "./build-event-timestamps";

describe("buildEventTimestamps", () => {
  it("builds an all-day event spanning just startDate", () => {
    const result = buildEventTimestamps({ mode: "allDay", startDate: "2026-10-15" });
    expect(result).toEqual({ allDay: true, startAt: "2026-10-15T00:00:00.000Z", endAt: null });
  });
  it("builds a same-day time range", () => {
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "09:00",
      endTime: "10:30",
    });
    expect(result).toEqual({
      allDay: false,
      startAt: "2026-10-15T09:00:00.000Z",
      endAt: "2026-10-15T10:30:00.000Z",
    });
  });
  it("rejects a time range where end is before start", () => {
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "10:30",
      endTime: "09:00",
    });
    expect(result).toEqual({ error: "End time must be after start time" });
  });
  it("builds a multi-day date range", () => {
    const result = buildEventTimestamps({ mode: "dateRange", startDate: "2026-10-15", endDate: "2026-10-17" });
    expect(result).toEqual({
      allDay: true,
      startAt: "2026-10-15T00:00:00.000Z",
      endAt: "2026-10-17T00:00:00.000Z",
    });
  });
  it("rejects a date range where end is before start", () => {
    const result = buildEventTimestamps({ mode: "dateRange", startDate: "2026-10-17", endDate: "2026-10-15" });
    expect(result).toEqual({ error: "End date must be on or after start date" });
  });
});

import { describe, it, expect } from "vitest";
import { buildEventTimestamps } from "./build-event-timestamps";

describe("buildEventTimestamps", () => {
  it("builds an all-day event spanning just startDate (interpreted in UTC)", () => {
    const result = buildEventTimestamps({ mode: "allDay", startDate: "2026-10-15", timeZone: "UTC" });
    expect(result).toEqual({ allDay: true, startAt: "2026-10-15T00:00:00.000Z", endAt: null });
  });

  it("builds a same-day time range (interpreted in UTC)", () => {
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "09:00",
      endTime: "10:30",
      timeZone: "UTC",
    });
    expect(result).toEqual({
      allDay: false,
      startAt: "2026-10-15T09:00:00.000Z",
      endAt: "2026-10-15T10:30:00.000Z",
    });
  });

  it("interprets a morning time in Asia/Seoul (UTC+9) as the correct earlier UTC instant", () => {
    // This is the exact bug: a naive `new Date(...)` on a UTC server would
    // have stored 09:00 as 09:00Z (afternoon in Korea). The acting user's
    // timezone must shift it to the real UTC instant, 00:00Z.
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "09:00",
      endTime: "10:30",
      timeZone: "Asia/Seoul",
    });
    expect(result).toEqual({
      allDay: false,
      startAt: "2026-10-15T00:00:00.000Z",
      endAt: "2026-10-15T01:30:00.000Z",
    });
  });

  it("builds a time range that crosses midnight given a separate endDate", () => {
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "23:00",
      endDate: "2026-10-16",
      endTime: "01:00",
      timeZone: "UTC",
    });
    expect(result).toEqual({
      allDay: false,
      startAt: "2026-10-15T23:00:00.000Z",
      endAt: "2026-10-16T01:00:00.000Z",
    });
  });

  it("defaults endDate to startDate when omitted, preserving same-day behavior", () => {
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "09:00",
      endTime: "10:30",
      timeZone: "UTC",
    });
    expect(result).toEqual({
      allDay: false,
      startAt: "2026-10-15T09:00:00.000Z",
      endAt: "2026-10-15T10:30:00.000Z",
    });
  });

  it("rejects a 'midnight-crossing' time range that isn't actually after start (same date picked for both)", () => {
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "23:00",
      endDate: "2026-10-15",
      endTime: "01:00",
      timeZone: "UTC",
    });
    expect(result).toEqual({ error: "End time must be after start time" });
  });

  it("rejects a time range where end is before start", () => {
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "10:30",
      endTime: "09:00",
      timeZone: "Asia/Seoul",
    });
    expect(result).toEqual({ error: "End time must be after start time" });
  });

  it("builds a multi-day date range (interpreted in UTC)", () => {
    const result = buildEventTimestamps({
      mode: "dateRange",
      startDate: "2026-10-15",
      endDate: "2026-10-17",
      timeZone: "UTC",
    });
    expect(result).toEqual({
      allDay: true,
      startAt: "2026-10-15T00:00:00.000Z",
      endAt: "2026-10-17T00:00:00.000Z",
    });
  });

  it("rejects a date range where end is before start", () => {
    const result = buildEventTimestamps({
      mode: "dateRange",
      startDate: "2026-10-17",
      endDate: "2026-10-15",
      timeZone: "Asia/Seoul",
    });
    expect(result).toEqual({ error: "End date must be on or after start date" });
  });
});

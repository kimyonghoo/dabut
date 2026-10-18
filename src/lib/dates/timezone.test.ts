import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIMEZONE,
  formatInTimeZone,
  toZonedDateInputValue,
  toZonedTimeInputValue,
  zonedDateParts,
  zonedDateTimeToUtcIso,
} from "./timezone";

describe("zonedDateTimeToUtcIso", () => {
  it("interprets a morning time in Asia/Seoul (UTC+9) as the correct earlier UTC instant", () => {
    // 09:00 KST on Oct 18 is 00:00 UTC the same day.
    expect(zonedDateTimeToUtcIso("2026-10-18", "09:00", "Asia/Seoul")).toBe("2026-10-18T00:00:00.000Z");
  });

  it("rolls over to the previous UTC day when the zoned time is before UTC midnight equivalent", () => {
    // 01:00 KST on Oct 18 is 16:00 UTC on Oct 17.
    expect(zonedDateTimeToUtcIso("2026-10-18", "01:00", "Asia/Seoul")).toBe("2026-10-17T16:00:00.000Z");
  });

  it("treats UTC as a no-op offset", () => {
    expect(zonedDateTimeToUtcIso("2026-10-18", "09:00", "UTC")).toBe("2026-10-18T09:00:00.000Z");
  });

  it("defaults the time to midnight when omitted (all-day events)", () => {
    expect(zonedDateTimeToUtcIso("2026-10-18", undefined, "Asia/Seoul")).toBe("2026-10-17T15:00:00.000Z");
  });

  it("handles a negative, DST-observing offset (America/New_York, EDT = UTC-4 in October)", () => {
    expect(zonedDateTimeToUtcIso("2026-10-18", "09:00", "America/New_York")).toBe("2026-10-18T13:00:00.000Z");
  });

  it("handles winter in a DST zone (America/New_York, EST = UTC-5 in January)", () => {
    expect(zonedDateTimeToUtcIso("2026-01-18", "09:00", "America/New_York")).toBe("2026-01-18T14:00:00.000Z");
  });
});

describe("zonedDateParts / input-value helpers round-trip zonedDateTimeToUtcIso", () => {
  it("round-trips a Seoul morning time through storage and back", () => {
    const iso = zonedDateTimeToUtcIso("2026-10-18", "09:00", "Asia/Seoul");
    expect(toZonedDateInputValue(iso, "Asia/Seoul")).toBe("2026-10-18");
    expect(toZonedTimeInputValue(iso, "Asia/Seoul")).toBe("09:00");
  });

  it("the same instant reads as a different wall-clock day/time in another zone", () => {
    const iso = zonedDateTimeToUtcIso("2026-10-18", "01:00", "Asia/Seoul"); // 2026-10-17T16:00:00.000Z
    expect(toZonedDateInputValue(iso, "UTC")).toBe("2026-10-17");
    expect(toZonedTimeInputValue(iso, "UTC")).toBe("16:00");
  });

  it("exposes the weekday of the zoned calendar day, not the UTC instant's day", () => {
    // 2026-10-18 is a Sunday; 01:00 KST on Oct 18 is still Oct 17 (Saturday) in UTC.
    const iso = zonedDateTimeToUtcIso("2026-10-18", "01:00", "Asia/Seoul");
    expect(zonedDateParts(iso, "Asia/Seoul").weekday).toBe(0); // Sunday in the zone it was entered in
    expect(zonedDateParts(iso, "UTC").weekday).toBe(6); // Saturday in UTC
  });
});

describe("formatInTimeZone", () => {
  it("formats a UTC instant using the given zone instead of the runtime's zone", () => {
    const iso = "2026-10-18T00:00:00.000Z"; // 09:00 in Seoul
    const seoul = formatInTimeZone(iso, "Asia/Seoul", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const utc = formatInTimeZone(iso, "UTC", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    expect(seoul).toBe("09:00");
    expect(utc).toBe("00:00");
  });
});

describe("DEFAULT_TIMEZONE", () => {
  it("is Asia/Seoul", () => {
    expect(DEFAULT_TIMEZONE).toBe("Asia/Seoul");
  });
});

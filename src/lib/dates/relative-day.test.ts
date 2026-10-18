import { describe, it, expect } from "vitest";
import { dateGroupLabel, formatDateKey, getRelativeDay, toDateKey } from "./relative-day";

const labels = { today: "Today", yesterday: "Yesterday", tomorrow: "Tomorrow" } as const;
const tr = (key: keyof typeof labels) => labels[key];

describe("getRelativeDay", () => {
  it("detects today, yesterday, tomorrow", () => {
    expect(getRelativeDay("2026-10-18", "2026-10-18")).toBe("today");
    expect(getRelativeDay("2026-10-17", "2026-10-18")).toBe("yesterday");
    expect(getRelativeDay("2026-10-19", "2026-10-18")).toBe("tomorrow");
  });

  it("returns null for other days", () => {
    expect(getRelativeDay("2026-10-16", "2026-10-18")).toBeNull();
    expect(getRelativeDay("2026-10-20", "2026-10-18")).toBeNull();
    expect(getRelativeDay("2025-10-18", "2026-10-18")).toBeNull();
  });

  it("handles month, year and DST-free boundaries", () => {
    expect(getRelativeDay("2026-09-30", "2026-10-01")).toBe("yesterday");
    expect(getRelativeDay("2027-01-01", "2026-12-31")).toBe("tomorrow");
    expect(getRelativeDay("2024-02-29", "2024-03-01")).toBe("yesterday");
  });

  it("returns null for malformed keys", () => {
    expect(getRelativeDay("2026-10-18T00:00", "2026-10-18")).toBeNull();
    expect(getRelativeDay("2026-10-18", "")).toBeNull();
  });
});

describe("toDateKey", () => {
  it("formats a local date as yyyy-MM-dd", () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("formatDateKey", () => {
  it("formats per locale", () => {
    expect(formatDateKey("2026-10-16", "ko")).toBe("10월 16일 (금)");
    expect(formatDateKey("2026-10-16", "en")).toBe("Fri, October 16");
    expect(formatDateKey("2026-10-16", "zh")).toBe("10月16日周五");
  });

  it("adds the year only when it differs from today", () => {
    expect(formatDateKey("2026-10-16", "en", "2026-10-18")).toBe("Fri, October 16");
    expect(formatDateKey("2025-10-16", "en", "2026-10-18")).toBe("Thu, October 16, 2025");
  });
});

describe("dateGroupLabel", () => {
  it("uses the relative word when applicable", () => {
    expect(dateGroupLabel("2026-10-18", "2026-10-18", "en", tr)).toBe("Today");
    expect(dateGroupLabel("2026-10-17", "2026-10-18", "en", tr)).toBe("Yesterday");
    expect(dateGroupLabel("2026-10-19", "2026-10-18", "en", tr)).toBe("Tomorrow");
  });

  it("falls back to the plain date", () => {
    expect(dateGroupLabel("2026-10-16", "2026-10-18", "en", tr)).toBe("Fri, October 16");
  });
});

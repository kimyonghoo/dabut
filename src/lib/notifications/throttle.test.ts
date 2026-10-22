import { describe, expect, it } from "vitest";
import { isOutsideNotifyWindow } from "./throttle";

describe("isOutsideNotifyWindow", () => {
  const now = Date.parse("2026-10-22T10:00:00Z");
  it("notifies when never notified", () => expect(isOutsideNotifyWindow(null, now)).toBe(true));
  it("skips within 2 minutes", () => expect(isOutsideNotifyWindow("2026-10-22T09:58:30Z", now)).toBe(false));
  it("notifies at exactly 2 minutes and later", () => {
    expect(isOutsideNotifyWindow("2026-10-22T09:58:00Z", now)).toBe(true);
    expect(isOutsideNotifyWindow("2026-10-22T09:00:00Z", now)).toBe(true);
  });
});

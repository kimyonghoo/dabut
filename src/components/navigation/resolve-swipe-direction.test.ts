import { describe, it, expect } from "vitest";
import { resolveSwipeDirection } from "./resolve-swipe-direction";

describe("resolveSwipeDirection", () => {
  it("returns 'next' for a decisive leftward swipe", () => {
    expect(resolveSwipeDirection(-100, -600)).toBe("next");
  });

  it("returns 'prev' for a decisive rightward swipe", () => {
    expect(resolveSwipeDirection(100, 600)).toBe("prev");
  });

  it("returns null for a small drift below the offset and velocity thresholds", () => {
    expect(resolveSwipeDirection(10, 50)).toBeNull();
  });

  it("returns 'next' when offset is small but velocity is decisively fast", () => {
    expect(resolveSwipeDirection(-20, -600)).toBe("next");
  });
});

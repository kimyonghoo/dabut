import { describe, it, expect } from "vitest";
import { POSITION_THRESHOLD_RATIO, REVEAL_WIDTH, resolveSwipeReveal } from "./resolve-swipe-reveal";

const POSITION_THRESHOLD = REVEAL_WIDTH * POSITION_THRESHOLD_RATIO;

describe("resolveSwipeReveal", () => {
  it("opens after a left drag past the reveal-width threshold", () => {
    expect(resolveSwipeReveal(-(POSITION_THRESHOLD + 1), 0, false)).toBe(true);
    expect(resolveSwipeReveal(-(POSITION_THRESHOLD - 1), 0, false)).toBe(false);
  });

  it("opens/closes on a fast flick regardless of distance", () => {
    expect(resolveSwipeReveal(-5, -800, false)).toBe(true);
    expect(resolveSwipeReveal(5, 800, true)).toBe(false);
  });

  it("closes an open row dragged back to the right", () => {
    expect(resolveSwipeReveal(POSITION_THRESHOLD + 1, 0, true)).toBe(false);
    expect(resolveSwipeReveal(10, 0, true)).toBe(true);
  });

  it("never opens from a right drag", () => {
    expect(resolveSwipeReveal(120, 0, false)).toBe(false);
  });
});

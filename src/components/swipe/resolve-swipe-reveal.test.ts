import { describe, it, expect } from "vitest";
import { REVEAL_WIDTH, resolveSwipeReveal } from "./resolve-swipe-reveal";

describe("resolveSwipeReveal", () => {
  it("opens after a left drag past half the button width", () => {
    expect(resolveSwipeReveal(-(REVEAL_WIDTH / 2 + 1), 0, false)).toBe(true);
    expect(resolveSwipeReveal(-(REVEAL_WIDTH / 2 - 1), 0, false)).toBe(false);
  });

  it("opens/closes on a fast flick regardless of distance", () => {
    expect(resolveSwipeReveal(-5, -800, false)).toBe(true);
    expect(resolveSwipeReveal(5, 800, true)).toBe(false);
  });

  it("closes an open row dragged back to the right", () => {
    expect(resolveSwipeReveal(REVEAL_WIDTH / 2 + 1, 0, true)).toBe(false);
    expect(resolveSwipeReveal(10, 0, true)).toBe(true);
  });

  it("never opens from a right drag", () => {
    expect(resolveSwipeReveal(120, 0, false)).toBe(false);
  });
});

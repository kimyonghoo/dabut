import { describe, it, expect } from "vitest";
import { crossedMilestoneThresholds } from "./payment-method-milestones";

describe("crossedMilestoneThresholds", () => {
  it("returns nothing when the total stays below every threshold", () => {
    expect(crossedMilestoneThresholds(10_000, 40_000, 100_000)).toEqual([]);
  });

  it("returns [50] when crossing only the first threshold", () => {
    expect(crossedMilestoneThresholds(40_000, 60_000, 100_000)).toEqual([50]);
  });

  it("returns [50, 80] when a single jump crosses two thresholds at once", () => {
    // 30% -> 95%: both 50% and 80% are newly crossed, 100% is not.
    expect(crossedMilestoneThresholds(30_000, 95_000, 100_000)).toEqual([50, 80]);
  });

  it("returns [50, 80, 100] when a single jump crosses all three at once", () => {
    expect(crossedMilestoneThresholds(10_000, 150_000, 100_000)).toEqual([50, 80, 100]);
  });

  it("treats landing exactly on a threshold as crossing it", () => {
    expect(crossedMilestoneThresholds(40_000, 50_000, 100_000)).toEqual([50]);
  });

  it("does not re-fire a threshold that was already passed before this change", () => {
    // Already at 60% before; spending more only pushes further past 50%.
    expect(crossedMilestoneThresholds(60_000, 70_000, 100_000)).toEqual([]);
  });

  it("does not re-fire 50 when already exactly at the threshold", () => {
    expect(crossedMilestoneThresholds(50_000, 60_000, 100_000)).toEqual([]);
  });

  it("returns nothing when the total decreases (e.g. editing an amount down)", () => {
    expect(crossedMilestoneThresholds(90_000, 60_000, 100_000)).toEqual([]);
  });

  it("returns nothing for a non-positive goal (treated as no goal set)", () => {
    expect(crossedMilestoneThresholds(0, 1_000_000, 0)).toEqual([]);
    expect(crossedMilestoneThresholds(0, 1_000_000, -100)).toEqual([]);
  });

  it("can cross 80 and 100 without 50 when already past 50 beforehand", () => {
    expect(crossedMilestoneThresholds(55_000, 120_000, 100_000)).toEqual([80, 100]);
  });

  it("handles fractional amounts without off-by-one drift", () => {
    expect(crossedMilestoneThresholds(49_999.5, 50_000, 100_000)).toEqual([50]);
  });
});

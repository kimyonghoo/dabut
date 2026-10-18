export const MILESTONE_THRESHOLDS = [50, 80, 100] as const;
export type MilestoneThreshold = (typeof MILESTONE_THRESHOLDS)[number];

/**
 * Returns the thresholds (50/80/100) that were just crossed *for the first
 * time* by a payment method's cumulative monthly spend moving from
 * `previousTotal` to `newTotal` against `goal`.
 *
 * A threshold is "newly crossed" when `previousTotal` is strictly below it
 * and `newTotal` is at or above it. This means:
 * - Spend that lands exactly on a threshold counts as crossing it.
 * - Further spend after a threshold was already passed never re-fires it
 *   (previousTotal is no longer below it).
 * - A single jump can cross more than one threshold at once (e.g. 30% -> 95%
 *   crosses both 50 and 80) — all of them are returned, in ascending order.
 * - A non-positive goal never "crosses" anything (treated as no goal set).
 *
 * This function is pure and has no knowledge of *who* has already been
 * notified — that dedupe lives in the milestone-log table, keyed off these
 * returned thresholds.
 */
export function crossedMilestoneThresholds(
  previousTotal: number,
  newTotal: number,
  goal: number
): MilestoneThreshold[] {
  if (!(goal > 0)) return [];
  return MILESTONE_THRESHOLDS.filter((threshold) => {
    const target = (goal * threshold) / 100;
    return previousTotal < target && newTotal >= target;
  });
}

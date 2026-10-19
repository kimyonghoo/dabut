/** Width (px) of the revealed delete button. */
export const REVEAL_WIDTH = 80;
// Raised from 400/50% so a swipe needs to be a bit more deliberate before
// the delete reveal snaps open — both thresholds were triggering on fairly
// casual drags/flicks.
const VELOCITY_THRESHOLD = 580;
/** Exported for tests only — keeps boundary-case assertions from drifting out of sync with this value. */
export const POSITION_THRESHOLD_RATIO = 0.62;

/**
 * Decide whether a horizontally dragged row should snap open (delete button
 * revealed) or closed. `offsetX` is the total drag offset for this gesture
 * (negative = left), `wasOpen` the state before the gesture began.
 */
export function resolveSwipeReveal(offsetX: number, velocityX: number, wasOpen: boolean): boolean {
  if (velocityX < -VELOCITY_THRESHOLD) return true;
  if (velocityX > VELOCITY_THRESHOLD) return false;
  const position = (wasOpen ? -REVEAL_WIDTH : 0) + offsetX;
  return position < -REVEAL_WIDTH * POSITION_THRESHOLD_RATIO;
}

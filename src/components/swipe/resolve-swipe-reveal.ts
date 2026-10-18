/** Width (px) of the revealed delete button. */
export const REVEAL_WIDTH = 80;
const VELOCITY_THRESHOLD = 400;

/**
 * Decide whether a horizontally dragged row should snap open (delete button
 * revealed) or closed. `offsetX` is the total drag offset for this gesture
 * (negative = left), `wasOpen` the state before the gesture began.
 */
export function resolveSwipeReveal(offsetX: number, velocityX: number, wasOpen: boolean): boolean {
  if (velocityX < -VELOCITY_THRESHOLD) return true;
  if (velocityX > VELOCITY_THRESHOLD) return false;
  const position = (wasOpen ? -REVEAL_WIDTH : 0) + offsetX;
  return position < -REVEAL_WIDTH / 2;
}

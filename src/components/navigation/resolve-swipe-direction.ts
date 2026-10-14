const OFFSET_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

export function resolveSwipeDirection(offsetX: number, velocityX: number): "next" | "prev" | null {
  const decisive = Math.abs(offsetX) > OFFSET_THRESHOLD || Math.abs(velocityX) > VELOCITY_THRESHOLD;
  if (!decisive) return null;
  return offsetX < 0 || velocityX < 0 ? "next" : "prev";
}

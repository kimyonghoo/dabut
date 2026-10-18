const CATEGORY_EMOJI: Record<string, string> = {
  식비: "🍚",
  육아: "🍼",
  문화: "🎬",
  경조사: "💐",
  월급: "💰",
};

export const DEFAULT_CATEGORY_EMOJI = "💸";

/** Emoji choices offered when a user adds a category. */
export const CATEGORY_EMOJI_CHOICES = ["🍚", "☕", "🛒", "🚕", "🏠", "💊", "🎁", "🐶", "✈️", "📚", "💄", "💸"] as const;

type CategoryLike = { name?: string | null; icon?: string | null };

/**
 * Emoji for a category: its own `icon` column when set, then the built-in
 * name map, then 💸. Accepts either a name (legacy call sites) or a category
 * object; an explicit `icon` argument also takes precedence.
 */
export function categoryEmoji(category?: string | CategoryLike | null, icon?: string | null): string {
  const value: CategoryLike =
    typeof category === "string" || category == null ? { name: category ?? null } : category;
  const ownIcon = (icon ?? value.icon)?.trim();
  if (ownIcon) return ownIcon;
  return (value.name && CATEGORY_EMOJI[value.name]) || DEFAULT_CATEGORY_EMOJI;
}

export function formatWon(amount: number): string {
  return `${Math.abs(amount).toLocaleString("ko-KR")}원`;
}

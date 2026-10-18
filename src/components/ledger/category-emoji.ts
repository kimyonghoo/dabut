const CATEGORY_EMOJI: Record<string, string> = {
  식비: "🍚",
  육아: "🍼",
  문화: "🎬",
  경조사: "💐",
  월급: "💰",
};

export function categoryEmoji(name?: string | null): string {
  return (name && CATEGORY_EMOJI[name]) || "💸";
}

export function formatWon(amount: number): string {
  return `${Math.abs(amount).toLocaleString("ko-KR")}원`;
}

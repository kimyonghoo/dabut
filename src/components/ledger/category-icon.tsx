import {
  BookOpen,
  Baby,
  Banknote,
  Clapperboard,
  Coffee,
  Coins,
  CarTaxiFront,
  Dog,
  Flower2,
  Gift,
  House,
  Pill,
  Plane,
  ShoppingCart,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/**
 * Category icons. `categories.icon` stores a key from this registry
 * (e.g. "utensils"). Older rows may still hold an emoji — LEGACY_EMOJI maps
 * those to a key so nothing breaks.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  "shopping-cart": ShoppingCart,
  taxi: CarTaxiFront,
  house: House,
  pill: Pill,
  gift: Gift,
  dog: Dog,
  plane: Plane,
  "book-open": BookOpen,
  sparkles: Sparkles,
  coins: Coins,
  baby: Baby,
  clapperboard: Clapperboard,
  flower: Flower2,
  banknote: Banknote,
};

/** Icons offered when a user adds a category. */
export const CATEGORY_ICON_CHOICES = [
  "utensils",
  "coffee",
  "shopping-cart",
  "taxi",
  "house",
  "pill",
  "gift",
  "dog",
  "plane",
  "book-open",
  "sparkles",
  "coins",
] as const;

export const DEFAULT_CATEGORY_ICON = "coins";

const NAME_ICON: Record<string, string> = {
  식비: "utensils",
  육아: "baby",
  문화: "clapperboard",
  경조사: "flower",
  월급: "banknote",
};

const LEGACY_EMOJI: Record<string, string> = {
  "🍚": "utensils",
  "☕": "coffee",
  "🛒": "shopping-cart",
  "🚕": "taxi",
  "🏠": "house",
  "💊": "pill",
  "🎁": "gift",
  "🐶": "dog",
  "✈️": "plane",
  "✈": "plane",
  "📚": "book-open",
  "💄": "sparkles",
  "💸": "coins",
  "🍼": "baby",
  "🎬": "clapperboard",
  "💐": "flower",
  "💰": "banknote",
};

type CategoryLike = { name?: string | null; icon?: string | null };

/** Resolve a category (or a bare name) to an icon key. */
export function categoryIconKey(category?: string | CategoryLike | null, icon?: string | null): string {
  const value: CategoryLike =
    typeof category === "string" || category == null ? { name: category ?? null } : category;
  const own = (icon ?? value.icon)?.trim();
  if (own) {
    if (CATEGORY_ICONS[own]) return own;
    if (LEGACY_EMOJI[own]) return LEGACY_EMOJI[own];
  }
  return (value.name && NAME_ICON[value.name]) || DEFAULT_CATEGORY_ICON;
}

export function CategoryIcon({
  category,
  icon,
  iconKey,
  className = "size-5",
  strokeWidth = 2,
}: {
  category?: string | CategoryLike | null;
  icon?: string | null;
  /** Render this key directly (used by the picker's choices). */
  iconKey?: string;
  className?: string;
  strokeWidth?: number;
}) {
  const key = iconKey && CATEGORY_ICONS[iconKey] ? iconKey : categoryIconKey(category, icon);
  const Icon = CATEGORY_ICONS[key] ?? Coins;
  return <Icon aria-hidden className={className} strokeWidth={strokeWidth} />;
}

export function formatWon(amount: number): string {
  return `${Math.abs(amount).toLocaleString("ko-KR")}원`;
}

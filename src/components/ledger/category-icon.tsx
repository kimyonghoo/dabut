import {
  Baby,
  Banknote,
  Beer,
  BookOpen,
  Bus,
  Car,
  CarTaxiFront,
  Cat,
  Clapperboard,
  Coffee,
  Coins,
  Dog,
  Droplet,
  Dumbbell,
  Flower2,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  GraduationCap,
  HandCoins,
  Heart,
  HeartPulse,
  House,
  IceCreamCone,
  Landmark,
  Lightbulb,
  Luggage,
  MapPin,
  MoreHorizontal,
  Motorbike,
  Music,
  PawPrint,
  Pencil,
  Phone,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Soup,
  Sparkles,
  Stethoscope,
  Ticket,
  TrainFront,
  TrendingUp,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  Wine,
  type LucideIcon,
} from "lucide-react";

/**
 * Category icons. `categories.icon` stores a key from this registry
 * (e.g. "utensils"). Older rows may still hold an emoji — LEGACY_EMOJI maps
 * those to a key so nothing breaks.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // food/dining
  utensils: Utensils,
  coffee: Coffee,
  pizza: Pizza,
  soup: Soup,
  "ice-cream-cone": IceCreamCone,
  wine: Wine,
  beer: Beer,
  // shopping
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  shirt: Shirt,
  gem: Gem,
  // transport
  taxi: CarTaxiFront,
  car: Car,
  bus: Bus,
  "train-front": TrainFront,
  bike: Motorbike,
  fuel: Fuel,
  // housing/utilities
  house: House,
  lightbulb: Lightbulb,
  droplet: Droplet,
  wifi: Wifi,
  phone: Phone,
  // health
  pill: Pill,
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  scissors: Scissors,
  // family/pets
  baby: Baby,
  dog: Dog,
  cat: Cat,
  "paw-print": PawPrint,
  // education
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  pencil: Pencil,
  // entertainment
  clapperboard: Clapperboard,
  gamepad: Gamepad2,
  music: Music,
  ticket: Ticket,
  // travel
  plane: Plane,
  luggage: Luggage,
  "map-pin": MapPin,
  // gifts/occasions
  gift: Gift,
  heart: Heart,
  flower: Flower2,
  // fitness
  dumbbell: Dumbbell,
  // subscriptions
  tv: Tv,
  smartphone: Smartphone,
  // finance/income
  coins: Coins,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  landmark: Landmark,
  wallet: Wallet,
  "hand-coins": HandCoins,
  // misc
  sparkles: Sparkles,
  "more-horizontal": MoreHorizontal,
};

/** Icons offered when a user adds a category. */
export const CATEGORY_ICON_CHOICES = [
  // food/dining
  "utensils",
  "coffee",
  "pizza",
  "soup",
  "ice-cream-cone",
  "wine",
  "beer",
  // shopping
  "shopping-cart",
  "shopping-bag",
  "shirt",
  "gem",
  // transport
  "taxi",
  "car",
  "bus",
  "train-front",
  "bike",
  "fuel",
  // housing/utilities
  "house",
  "lightbulb",
  "droplet",
  "wifi",
  "phone",
  // health
  "pill",
  "stethoscope",
  "heart-pulse",
  "scissors",
  // family/pets
  "baby",
  "dog",
  "cat",
  "paw-print",
  // education
  "book-open",
  "graduation-cap",
  "pencil",
  // entertainment
  "clapperboard",
  "gamepad",
  "music",
  "ticket",
  // travel
  "plane",
  "luggage",
  "map-pin",
  // gifts/occasions
  "gift",
  "heart",
  "flower",
  // fitness
  "dumbbell",
  // subscriptions
  "tv",
  "smartphone",
  // finance/income
  "coins",
  "banknote",
  "piggy-bank",
  "trending-up",
  "landmark",
  "wallet",
  "hand-coins",
  // misc
  "sparkles",
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

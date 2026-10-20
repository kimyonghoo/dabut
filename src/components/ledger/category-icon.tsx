import {
  Baby,
  Banknote,
  Beer,
  Bike,
  BookOpen,
  Bus,
  Car,
  CarTaxiFront,
  Cat,
  CircleParking,
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
  Groceries,
  HandCoins,
  Heart,
  HeartPulse,
  Hospital,
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
  Receipt,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Soup,
  Sparkles,
  Stethoscope,
  Store,
  Ticket,
  TrainFront,
  TrendingUp,
  Tv,
  UserRoundGroup,
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
  "shopping-basket": ShoppingBasket,
  groceries: Groceries,
  shirt: Shirt,
  gem: Gem,
  store: Store,
  // transport
  taxi: CarTaxiFront,
  car: Car,
  bus: Bus,
  "train-front": TrainFront,
  bike: Motorbike,
  bicycle: Bike,
  fuel: Fuel,
  "circle-parking": CircleParking,
  // housing/utilities
  house: House,
  lightbulb: Lightbulb,
  droplet: Droplet,
  wifi: Wifi,
  phone: Phone,
  receipt: Receipt,
  // health
  pill: Pill,
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  scissors: Scissors,
  hospital: Hospital,
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
  "user-round-group": UserRoundGroup,
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
  "shopping-basket",
  "groceries",
  "shirt",
  "gem",
  "store",
  // transport
  "taxi",
  "car",
  "bus",
  "train-front",
  "bike",
  "bicycle",
  "fuel",
  "circle-parking",
  // housing/utilities
  "house",
  "lightbulb",
  "droplet",
  "wifi",
  "phone",
  "receipt",
  // health
  "pill",
  "stethoscope",
  "heart-pulse",
  "scissors",
  "hospital",
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
  "user-round-group",
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
  문화: "ticket",
  경조사: "gift",
  쇼핑: "shopping-bag",
  교통: "bus",
  생필품: "shopping-basket",
  옷: "shirt",
  병원: "hospital",
  약국: "pill",
  공과금: "receipt",
  편의점: "store",
  카페: "coffee",
  구독: "user-round-group",
  주유: "fuel",
  통신비: "smartphone",
  배달음식: "bicycle",
  주차비: "circle-parking",
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

import { Banknote, CreditCard, type LucideIcon } from "lucide-react";

/**
 * Payment method icons. `payment_methods.icon` stores one of these two keys
 * ("card" | "cash"), or `null` for "no icon". Older rows may still hold a
 * free-text emoji from before this was cut down to a fixed choice — those
 * are rendered as literal text so nothing breaks.
 */
export const PAYMENT_METHOD_ICONS: Record<string, LucideIcon> = {
  card: CreditCard,
  cash: Banknote,
};

export const PAYMENT_METHOD_ICON_CHOICES = ["card", "cash"] as const;

/** Renders a payment method's icon: a known key, a legacy emoji, or the default fallback. */
export function PaymentMethodIcon({
  icon,
  className = "size-4",
  strokeWidth = 2,
}: {
  icon?: string | null;
  className?: string;
  strokeWidth?: number;
}) {
  const trimmed = icon?.trim();
  if (trimmed && PAYMENT_METHOD_ICONS[trimmed]) {
    const Icon = PAYMENT_METHOD_ICONS[trimmed];
    return <Icon aria-hidden className={className} strokeWidth={strokeWidth} />;
  }
  if (trimmed) {
    // Legacy free-text emoji from before the icon choices were fixed.
    return <span aria-hidden>{trimmed}</span>;
  }
  return <CreditCard aria-hidden className={className} strokeWidth={strokeWidth} />;
}

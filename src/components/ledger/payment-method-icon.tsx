"use client";

import { Banknote, CreditCard, type LucideIcon } from "lucide-react";
import { PAYMENT_BRANDS, detectPaymentBrand } from "./payment-brand";

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

export { PAYMENT_BRANDS, detectPaymentBrand };

function BrandIcon({ brand, className, strokeWidth }: { brand: string; className: string; strokeWidth: number }) {
  const def = PAYMENT_BRANDS.find((x) => x.key === brand);
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-md ${className}`}
      style={{ background: def?.color, color: def?.fg }}
    >
      <CreditCard className="size-[65%]" strokeWidth={strokeWidth} />
    </span>
  );
}

/** Renders a payment method's icon: a brand logo slot, a known key, a legacy emoji, or the default fallback. */
export function PaymentMethodIcon({
  icon,
  name,
  className = "size-4",
  strokeWidth = 2,
}: {
  icon?: string | null;
  name?: string | null;
  className?: string;
  strokeWidth?: number;
}) {
  const brand = detectPaymentBrand(name);
  if (brand) {
    return <BrandIcon brand={brand} className={className} strokeWidth={strokeWidth} />;
  }
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

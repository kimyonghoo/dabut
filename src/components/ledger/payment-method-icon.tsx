"use client";

import { useState } from "react";
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

/**
 * Brand slots. Official logo files are dropped into `public/payment-logos/`
 * by the owner (see README there); until then a neutral tinted badge is used.
 */
export const PAYMENT_BRANDS = [
  { key: "samsung", match: /삼성|samsung/i, label: "삼성카드" },
  { key: "kb", match: /국민|\bkb\b|kookmin/i, label: "국민카드" },
  { key: "bc", match: /\bbc\b|비씨/i, label: "BC카드" },
  { key: "clt", match: /clt|복지|cyberlogitec|사이버로지텍/i, label: "CLT 복지카드" },
  { key: "seoulpay", match: /서울\s*페이|seoul\s*pay/i, label: "서울페이" },
] as const;

const BRAND_TINTS: Record<string, string> = {
  samsung: "bg-sky-100 text-sky-700 dark:bg-white/10 dark:text-white/80",
  kb: "bg-amber-100 text-amber-700 dark:bg-white/10 dark:text-white/80",
  bc: "bg-rose-100 text-rose-700 dark:bg-white/10 dark:text-white/80",
  clt: "bg-indigo-100 text-indigo-700 dark:bg-white/10 dark:text-white/80",
  seoulpay: "bg-teal-100 text-teal-700 dark:bg-white/10 dark:text-white/80",
};

const LOGO_EXTENSIONS = ["png", "svg"] as const;

/** Returns the brand key whose pattern matches the payment method name, or null. */
export function detectPaymentBrand(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  for (const brand of PAYMENT_BRANDS) {
    if (brand.match.test(trimmed)) return brand.key;
  }
  return null;
}

function BrandIcon({ brand, className, strokeWidth }: { brand: string; className: string; strokeWidth: number }) {
  const [attempt, setAttempt] = useState(0);
  const box = "inline-grid place-items-center overflow-hidden rounded-md";

  if (attempt >= LOGO_EXTENSIONS.length) {
    return (
      <span aria-hidden className={`${box} ${BRAND_TINTS[brand] ?? ""} ${className}`}>
        <CreditCard className="size-[70%]" strokeWidth={strokeWidth} />
      </span>
    );
  }

  return (
    <span aria-hidden className={`${box} bg-white ring-1 ring-line ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt}
        src={`/payment-logos/${brand}.${LOGO_EXTENSIONS[attempt]}`}
        alt=""
        aria-hidden
        className="size-full object-contain"
        onError={() => setAttempt((n) => n + 1)}
      />
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

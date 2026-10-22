/** Card brand identity colors. `fg` is the icon color that stays legible on `color`. */
export const PAYMENT_BRANDS = [
  { key: "samsung", match: /삼성|samsung/i, label: "삼성카드", color: "#1428A0", fg: "#ffffff" },
  { key: "kb", match: /국민|\bkb\b|kookmin/i, label: "국민카드", color: "#FFD600", fg: "#1a1a1a" },
  { key: "bc", match: /\bbc\b|비씨/i, label: "BC카드", color: "#E30613", fg: "#ffffff" },
  { key: "clt", match: /clt|복지|cyberlogitec|사이버로지텍/i, label: "CLT 복지카드", color: "#000000", fg: "#ffffff" },
  { key: "seoulpay", match: /서울\s*페이|seoul\s*pay/i, label: "서울페이", color: "#00B5E2", fg: "#ffffff" },
] as const;

/** Returns the brand key whose pattern matches the payment method name, or null. */
export function detectPaymentBrand(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  for (const brand of PAYMENT_BRANDS) {
    if (brand.match.test(trimmed)) return brand.key;
  }
  return null;
}

export function paymentBrandColor(name?: string | null): string | null {
  const key = detectPaymentBrand(name);
  return PAYMENT_BRANDS.find((b) => b.key === key)?.color ?? null;
}

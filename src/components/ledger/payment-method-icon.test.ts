import { describe, expect, it } from "vitest";
import { detectPaymentBrand } from "./payment-method-icon";

describe("detectPaymentBrand", () => {
  it.each([
    ["삼성카드", "samsung"],
    ["Samsung Card", "samsung"],
    ["국민카드", "kb"],
    ["KB 국민", "kb"],
    ["BC카드", "bc"],
    ["비씨카드", "bc"],
    ["CLT 복지카드", "clt"],
    ["복지카드", "clt"],
    ["서울페이", "seoulpay"],
    ["서울 페이", "seoulpay"],
    ["Seoul Pay", "seoulpay"],
  ])("%s -> %s", (name, key) => {
    expect(detectPaymentBrand(name)).toBe(key);
  });

  it("returns null for unknown, empty, or missing names", () => {
    expect(detectPaymentBrand("현금")).toBeNull();
    expect(detectPaymentBrand("")).toBeNull();
    expect(detectPaymentBrand(null)).toBeNull();
    expect(detectPaymentBrand(undefined)).toBeNull();
  });
});

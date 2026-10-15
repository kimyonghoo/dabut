import { describe, it, expect } from "vitest";
import { validateAmount } from "./validate-amount";

describe("validateAmount", () => {
  it("accepts a positive number", () => {
    expect(validateAmount("12000")).toEqual({ amount: 12000 });
  });
  it("rejects zero", () => {
    expect(validateAmount("0")).toEqual({ error: "Amount must be greater than 0" });
  });
  it("rejects a negative number", () => {
    expect(validateAmount("-500")).toEqual({ error: "Amount must be greater than 0" });
  });
  it("rejects non-numeric input", () => {
    expect(validateAmount("abc")).toEqual({ error: "Amount must be greater than 0" });
  });
});

import { describe, it, expect } from "vitest";
import { resolveValidityMessage } from "./tooltip-input";

const valid = {
  valueMissing: false,
  typeMismatch: false,
  tooShort: false,
  tooLong: false,
  patternMismatch: false,
};

describe("resolveValidityMessage", () => {
  it("returns undefined when there are no messages to map", () => {
    expect(resolveValidityMessage({ ...valid, valueMissing: true }, undefined)).toBeUndefined();
  });

  it("maps valueMissing to its message", () => {
    expect(resolveValidityMessage({ ...valid, valueMissing: true }, { valueMissing: "required" })).toBe("required");
  });

  it("maps typeMismatch to its message", () => {
    expect(resolveValidityMessage({ ...valid, typeMismatch: true }, { typeMismatch: "bad email" })).toBe(
      "bad email"
    );
  });

  it("maps tooShort to its message", () => {
    expect(resolveValidityMessage({ ...valid, tooShort: true }, { tooShort: "too short" })).toBe("too short");
  });

  it("prioritizes valueMissing over other flags when several are set", () => {
    expect(
      resolveValidityMessage(
        { ...valid, valueMissing: true, typeMismatch: true },
        { valueMissing: "required", typeMismatch: "bad email" }
      )
    ).toBe("required");
  });

  it("returns undefined when the relevant message wasn't provided", () => {
    expect(resolveValidityMessage({ ...valid, patternMismatch: true }, { valueMissing: "required" })).toBeUndefined();
  });

  it("returns undefined when nothing is invalid", () => {
    expect(resolveValidityMessage(valid, { valueMissing: "required" })).toBeUndefined();
  });
});

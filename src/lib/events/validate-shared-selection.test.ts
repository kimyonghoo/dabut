import { describe, it, expect } from "vitest";
import { validateSharedSelection } from "./validate-shared-selection";

describe("validateSharedSelection", () => {
  it("rejects a shared event with no connection selected", () => {
    expect(validateSharedSelection(true, null)).toEqual({ error: "Select a connection to share with" });
  });
  it("accepts a shared event with a connection selected", () => {
    expect(validateSharedSelection(true, "conn-1")).toBeNull();
  });
  it("accepts a personal (non-shared) event with no connection", () => {
    expect(validateSharedSelection(false, null)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { categorizeEvent } from "./categorize-event";

describe("categorizeEvent", () => {
  it("returns 'shared' for a shared event regardless of owner", () => {
    expect(categorizeEvent({ owner_id: "me", visibility: "shared" }, "me")).toBe("shared");
    expect(categorizeEvent({ owner_id: "partner", visibility: "shared" }, "me")).toBe("shared");
  });
  it("returns 'mine' for my own personal event", () => {
    expect(categorizeEvent({ owner_id: "me", visibility: "personal" }, "me")).toBe("mine");
  });
  it("returns 'partner' for a connection member's personal event", () => {
    expect(categorizeEvent({ owner_id: "partner", visibility: "personal" }, "me")).toBe("partner");
  });
});

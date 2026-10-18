import { describe, expect, it } from "vitest";
import { categorizeTransaction } from "./categorize-transaction";

describe("categorizeTransaction", () => {
  it("returns mine when the row's owner is the current user", () => {
    expect(categorizeTransaction({ ownerId: "user-1" }, "user-1")).toBe("mine");
  });

  it("returns partner when the row's owner is someone else", () => {
    expect(categorizeTransaction({ ownerId: "user-2" }, "user-1")).toBe("partner");
  });
});

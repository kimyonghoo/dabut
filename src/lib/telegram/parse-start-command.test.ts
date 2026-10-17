import { describe, it, expect } from "vitest";
import { parseStartCommand } from "./parse-start-command";

describe("parseStartCommand", () => {
  it("extracts the code from a /start command", () => {
    expect(parseStartCommand("/start abc123")).toBe("abc123");
  });

  it("returns null for a bare /start with no code", () => {
    expect(parseStartCommand("/start")).toBeNull();
  });

  it("returns null for unrelated text", () => {
    expect(parseStartCommand("hello there")).toBeNull();
  });
});

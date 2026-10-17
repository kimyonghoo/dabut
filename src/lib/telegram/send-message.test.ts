import { describe, it, expect, vi, afterEach } from "vitest";
import { sendTelegramMessage } from "./send-message";

describe("sendTelegramMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when the fetch call itself fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    await expect(sendTelegramMessage("12345", "hello")).resolves.toBeUndefined();
  });

  it("does not throw when Telegram responds with an error status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 400 })
    );
    await expect(sendTelegramMessage("12345", "hello")).resolves.toBeUndefined();
  });
});

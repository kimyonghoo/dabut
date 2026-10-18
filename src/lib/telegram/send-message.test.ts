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

  it("sends parse_mode: HTML so bold/italic markup in the message renders", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await sendTelegramMessage("12345", "<b>hello</b>");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({ chat_id: "12345", text: "<b>hello</b>", parse_mode: "HTML" });
  });
});

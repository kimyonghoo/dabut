import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  sendTelegramMessage: vi.fn(async (_chatId: string, _text: string) => undefined),
}));

vi.mock("./send-message", () => ({ sendTelegramMessage: mocks.sendTelegramMessage }));

import { handleSignupStart } from "./handle-signup-start";

type Row = { link_expires_at: string; last_sent_at: string | null };

function fakeSupabase(row: Row | null) {
  const updates: Record<string, unknown>[] = [];
  const client = {
    from: (table: string) => {
      if (table !== "signup_verifications") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error: null }),
          }),
        }),
        update: (values: Record<string, unknown>) => {
          updates.push(values);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { client, updates };
}

function future(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}
function past(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

describe("handleSignupStart", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("sends a 'not found' message when the token has no row", async () => {
    const { client } = fakeSupabase(null);
    await handleSignupStart(client, "tok", "chat-1");
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("chat-1", expect.stringContaining("찾을 수 없어요"));
  });

  it("sends an 'expired' message when the deep link has expired", async () => {
    const { client } = fakeSupabase({ link_expires_at: past(1000), last_sent_at: null });
    await handleSignupStart(client, "tok", "chat-1");
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("chat-1", expect.stringContaining("만료"));
  });

  it("throttles a resend within the cooldown window instead of sending a new OTP", async () => {
    const { client, updates } = fakeSupabase({
      link_expires_at: future(60_000),
      last_sent_at: new Date().toISOString(),
    });
    await handleSignupStart(client, "tok", "chat-1");
    expect(updates).toHaveLength(0);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith("chat-1", expect.stringContaining("잠시 후"));
  });

  it("generates and sends a fresh OTP, storing its hash and the chat id, resetting attempts", async () => {
    const { client, updates } = fakeSupabase({ link_expires_at: future(60_000), last_sent_at: null });
    await handleSignupStart(client, "tok", "chat-1");

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ telegram_chat_id: "chat-1", attempts: 0 });
    expect(updates[0].otp_hash).toEqual(expect.any(String));
    expect(updates[0].otp_expires_at).toEqual(expect.any(String));
    expect(updates[0].last_sent_at).toEqual(expect.any(String));

    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
    const [, message] = mocks.sendTelegramMessage.mock.calls[0];
    expect(message).toMatch(/\d{6}/);
  });

  it("allows a resend once the cooldown has passed", async () => {
    const { client, updates } = fakeSupabase({
      link_expires_at: future(60_000),
      last_sent_at: past(60_000),
    });
    await handleSignupStart(client, "tok", "chat-1");
    expect(updates).toHaveLength(1);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
  });
});

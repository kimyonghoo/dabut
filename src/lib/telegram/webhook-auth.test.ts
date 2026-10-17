import { describe, it, expect, beforeEach } from "vitest";
import { isValidWebhookSecret } from "./webhook-auth";

describe("isValidWebhookSecret", () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "s3cr3t";
  });

  it("accepts the header when it matches TELEGRAM_WEBHOOK_SECRET", () => {
    expect(isValidWebhookSecret("s3cr3t")).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(isValidWebhookSecret(null)).toBe(false);
  });

  it("rejects a mismatched header", () => {
    expect(isValidWebhookSecret("wrong")).toBe(false);
  });
});

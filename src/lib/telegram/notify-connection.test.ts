import { describe, it, expect } from "vitest";
import { notifyConnectionMembers } from "./notify-connection";

describe("notifyConnectionMembers", () => {
  it("does nothing and never touches the database when connectionId is null", async () => {
    const untouchable = new Proxy(
      {},
      {
        get() {
          throw new Error("supabase client should not be touched when connectionId is null");
        },
      }
    );
    await expect(
      notifyConnectionMembers(untouchable as never, {
        connectionId: null,
        excludeUserId: "user-1",
        message: "test",
      })
    ).resolves.toBeUndefined();
  });
});

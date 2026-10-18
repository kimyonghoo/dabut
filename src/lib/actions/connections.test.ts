import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  sendConnectionInvitation,
  declineConnectionInvitation,
  cancelConnectionInvitation,
} from "./connections";

// A minimal chainable query-builder mock. `.select()/.eq()/.insert()/.update()`
// just keep chaining; the chain itself is awaitable (like a real
// PostgrestFilterBuilder) and `.maybeSingle()` resolves the configured result
// for the Nth `.from("connection_invitations")` call in call order, matching
// sendConnectionInvitation's fixed call sequence: same-direction pending
// check, then reverse-direction pending check, then the insert.
function fakeInviteSupabase(opts: {
  samePending?: { id: string } | null;
  reversePending?: { id: string } | null;
  insertError?: { message: string; code?: string } | null;
  noUser?: boolean;
}) {
  let callCount = 0;
  const client = {
    auth: {
      getUser: async () => ({ data: { user: opts.noUser ? null : { id: "user-1" } } }),
    },
    from: (table: string) => {
      if (table !== "connection_invitations") throw new Error(`unexpected table ${table}`);
      callCount += 1;
      const thisCall = callCount;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        insert: () => builder,
        maybeSingle: async () => {
          if (thisCall === 1) return { data: opts.samePending ?? null, error: null };
          if (thisCall === 2) return { data: opts.reversePending ?? null, error: null };
          throw new Error(`unexpected maybeSingle on call ${thisCall}`);
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ data: null, error: opts.insertError ?? null }).then(resolve, reject),
      };
      return builder;
    },
  };
  return client;
}

describe("sendConnectionInvitation", () => {
  it("returns Not authenticated when there is no session", async () => {
    mocks.createClient.mockResolvedValue(fakeInviteSupabase({ noUser: true }));

    const result = await sendConnectionInvitation("invitee-1");

    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns a localized duplicateInvite code (not the raw Postgres error) when a pending invite already exists in the same direction", async () => {
    mocks.createClient.mockResolvedValue(fakeInviteSupabase({ samePending: { id: "existing-1" } }));

    const result = await sendConnectionInvitation("invitee-1");

    expect(result).toEqual({ error: "duplicateInvite" });
  });

  it("returns pendingFromTarget when the target already invited the current user", async () => {
    mocks.createClient.mockResolvedValue(fakeInviteSupabase({ reversePending: { id: "existing-2" } }));

    const result = await sendConnectionInvitation("invitee-1");

    expect(result).toEqual({ error: "pendingFromTarget" });
  });

  it("inserts and succeeds when no pending invitation exists in either direction", async () => {
    mocks.createClient.mockResolvedValue(fakeInviteSupabase({ insertError: null }));

    const result = await sendConnectionInvitation("invitee-1");

    expect(result).toEqual({});
  });

  it("maps a unique-violation (23505) insert race to duplicateInvite instead of the raw DB message", async () => {
    mocks.createClient.mockResolvedValue(
      fakeInviteSupabase({
        insertError: {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "connection_invitations_pending_pair_idx"',
        },
      })
    );

    const result = await sendConnectionInvitation("invitee-1");

    expect(result).toEqual({ error: "duplicateInvite" });
  });

  it("maps a row-level-security insert failure to alreadyConnected", async () => {
    mocks.createClient.mockResolvedValue(
      fakeInviteSupabase({
        insertError: {
          message: 'new row violates row-level security policy for table "connection_invitations"',
        },
      })
    );

    const result = await sendConnectionInvitation("invitee-1");

    expect(result).toEqual({ error: "alreadyConnected" });
  });

  it("returns the raw database error message for anything else unexpected", async () => {
    mocks.createClient.mockResolvedValue(
      fakeInviteSupabase({ insertError: { message: "some other database error" } })
    );

    const result = await sendConnectionInvitation("invitee-1");

    expect(result).toEqual({ error: "some other database error" });
  });
});

function fakeUpdateSupabase(opts: { error?: { message: string } | null; noUser?: boolean }) {
  const eqCalls: Array<[string, unknown]> = [];
  let updatePayload: Record<string, unknown> | null = null;
  const client = {
    auth: { getUser: async () => ({ data: { user: opts.noUser ? null : { id: "user-1" } } }) },
    from: (table: string) => {
      if (table !== "connection_invitations") throw new Error(`unexpected table ${table}`);
      const builder: Record<string, unknown> = {
        update: (payload: Record<string, unknown>) => {
          updatePayload = payload;
          return builder;
        },
        eq: (column: string, value: unknown) => {
          eqCalls.push([column, value]);
          return builder;
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ data: null, error: opts.error ?? null }).then(resolve, reject),
      };
      return builder;
    },
  };
  return { client, eqCalls, getUpdatePayload: () => updatePayload };
}

describe("declineConnectionInvitation", () => {
  it("returns Not authenticated when there is no session", async () => {
    const { client } = fakeUpdateSupabase({ noUser: true });
    mocks.createClient.mockResolvedValue(client);

    const result = await declineConnectionInvitation("inv-1");

    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("sets status to declined, scoped to the invitee and a still-pending row", async () => {
    const { client, eqCalls, getUpdatePayload } = fakeUpdateSupabase({ error: null });
    mocks.createClient.mockResolvedValue(client);

    const result = await declineConnectionInvitation("inv-1");

    expect(result).toEqual({});
    expect(getUpdatePayload()).toMatchObject({ status: "declined" });
    expect(eqCalls).toEqual([
      ["id", "inv-1"],
      ["invitee_id", "user-1"],
      ["status", "pending"],
    ]);
  });

  it("returns the database error when the update fails", async () => {
    const { client } = fakeUpdateSupabase({ error: { message: "no matching row" } });
    mocks.createClient.mockResolvedValue(client);

    const result = await declineConnectionInvitation("inv-1");

    expect(result).toEqual({ error: "no matching row" });
  });
});

describe("cancelConnectionInvitation", () => {
  it("sets status to cancelled, scoped to the inviter and a still-pending row", async () => {
    const { client, eqCalls, getUpdatePayload } = fakeUpdateSupabase({ error: null });
    mocks.createClient.mockResolvedValue(client);

    const result = await cancelConnectionInvitation("inv-1");

    expect(result).toEqual({});
    expect(getUpdatePayload()).toMatchObject({ status: "cancelled" });
    expect(eqCalls).toEqual([
      ["id", "inv-1"],
      ["inviter_id", "user-1"],
      ["status", "pending"],
    ]);
  });

  it("returns the database error when the update fails", async () => {
    const { client } = fakeUpdateSupabase({ error: { message: "no matching row" } });
    mocks.createClient.mockResolvedValue(client);

    const result = await cancelConnectionInvitation("inv-1");

    expect(result).toEqual({ error: "no matching row" });
  });
});

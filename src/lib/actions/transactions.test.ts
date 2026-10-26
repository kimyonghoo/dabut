import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  createClient: vi.fn(),
  notifyConnectionMembers: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "ko" }));
vi.mock("@/i18n/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/telegram/notify-connection", () => ({ notifyConnectionMembers: mocks.notifyConnectionMembers }));
vi.mock("@/lib/telegram/actor-name", () => ({ resolveActorName: async () => "tester" }));

import { createTransaction } from "./transactions";

function fakeSupabase(opts: {
  memberships: { connection_id: string }[];
  insertError?: { message: string } | null;
}) {
  const inserted: Record<string, unknown>[] = [];
  const membershipQuery = {
    select: () => membershipQuery,
    eq: () => membershipQuery,
    order: () => membershipQuery,
    limit: async () => ({ data: opts.memberships, error: null }),
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "u@example.com" } } }) },
    from: (table: string) => {
      if (table === "connection_members") return membershipQuery;
      if (table === "transactions") {
        return {
          insert: (row: Record<string, unknown>) => {
            inserted.push(row);
            return {
              select: () => ({
                maybeSingle: async () =>
                  opts.insertError
                    ? { data: null, error: opts.insertError }
                    : {
                        data: { connection_id: row.connection_id, type: row.type, amount: row.amount, categories: { name: "외식" } },
                        error: null,
                      },
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client, inserted };
}

function form() {
  const fd = new FormData();
  fd.set("type", "expense");
  fd.set("amount", "12000");
  fd.set("categoryId", "cat-1");
  fd.set("occurredAt", "2026-10-18");
  fd.set("memo", "점심");
  return fd;
}

describe("createTransaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo user: inserts a personal entry (connection_id null, owned by caller), revalidates and redirects to the ledger", async () => {
    const { client, inserted } = fakeSupabase({ memberships: [] });
    mocks.createClient.mockResolvedValue(client);

    await expect(createTransaction({}, form())).rejects.toThrow("NEXT_REDIRECT");

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      connection_id: null,
      owner_id: "user-1",
      created_by: "user-1",
      category_id: "cat-1",
      type: "expense",
      amount: 12000,
      memo: "점심",
      occurred_at: "2026-10-18",
    });
    expect(mocks.notifyConnectionMembers).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: { pathname: "/ledger", query: { saved: "1", sn: "외식", si: "", sa: "12000", month: "2026-10" } },
      locale: "ko",
    });
  });

  it("paired user: scopes the entry to the caller's connection", async () => {
    const { client, inserted } = fakeSupabase({ memberships: [{ connection_id: "conn-1" }] });
    mocks.createClient.mockResolvedValue(client);

    await expect(createTransaction({}, form())).rejects.toThrow("NEXT_REDIRECT");

    expect(inserted[0]).toMatchObject({ connection_id: "conn-1", owner_id: "user-1", created_by: "user-1" });
    expect(mocks.notifyConnectionMembers).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ connectionId: "conn-1", excludeUserId: "user-1" })
    );
    expect(mocks.redirect).toHaveBeenCalled();
  });

  it("returns the database error and does not redirect when the insert fails", async () => {
    const { client } = fakeSupabase({
      memberships: [],
      insertError: { message: 'new row violates row-level security policy for table "transactions"' },
    });
    mocks.createClient.mockResolvedValue(client);

    const result = await createTransaction({}, form());

    expect(result.error).toMatch(/row-level security/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

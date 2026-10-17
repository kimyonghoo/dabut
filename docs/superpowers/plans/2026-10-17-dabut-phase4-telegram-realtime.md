# Dabut Phase 4 — Telegram Notifications & Realtime Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every event/transaction CRUD pushes a Telegram message to the other connection
member(s), a user can link their own Telegram account from Settings via a deep link, and
the calendar/ledger/settings pages update live via Supabase Realtime instead of needing a
manual reload.

**Architecture:** A new `telegram_link_codes` table (owner-only RLS) backs a deep-link +
webhook linking flow; a thin `src/lib/telegram/` module (pure message builders + a
fire-and-forget sender + a connection-fan-out helper) gets called from the existing
`events.ts`/`transactions.ts` Server Actions after each successful write; Supabase Realtime
is enabled on `events`, `transactions`, `profiles` and consumed by one small client
component per page plus a Settings-specific subscription.

**Tech Stack:** Reuses everything already in the project — Next.js Route Handlers (new, for
the webhook), `@supabase/supabase-js` service-role client (new helper), `pg` (already a
dependency, used the same way `scripts/verify-phase1.mjs` already uses it), `date-fns`
(already a dependency, for message date formatting). No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-17-dabut-phase4-telegram-realtime-design.md` —
this plan implements that design in full. Read both; the design doc carries the "why" and
the rejected alternatives, this plan carries the exact files/signatures/tests.

## Global Constraints

- No phone numbers anywhere; email is the identifier (unchanged from Phase 1).
- A failed Telegram API call must never fail or roll back the CRUD action that triggered it
  (design doc Anti-Goals).
- The webhook endpoint must reject any request without a valid
  `X-Telegram-Bot-Api-Secret-Token` header (design doc Anti-Goals).
- `telegram_link_codes` must be readable/writable only by its own `user_id = auth.uid()` —
  no connection-member or pending-invitation visibility, unlike `profiles` (design doc §1,
  the corrected security fix).
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` are supplied by
  the human partner directly in Vercel and `.env.local` — no task in this plan enters them
  anywhere.
- Notification message text is Korean-only (not run through next-intl) — this is a
  deliberate scope cut from the design doc, not an oversight.
- Migrations are applied with a script against `SUPABASE_DB_URL` (the same pattern
  `scripts/verify-phase1.mjs` already uses), not pasted into the Supabase Dashboard.

## Review Focus

- A Telegram API call throws or returns a non-2xx status while sending a CRUD notification —
  the triggering `createEvent`/`createTransaction`/etc. action must still return success to
  the user, not surface a Telegram failure as their own error. (Task 2)
- A webhook POST arrives with a missing or wrong `X-Telegram-Bot-Api-Secret-Token` header —
  must be rejected before any database access, not merely logged. (Task 3)
- A `/start` message with no code, a malformed command, or a code that matches no row in
  `telegram_link_codes` (typo'd or already consumed) — must not crash the webhook and must
  still return 200 to Telegram (a non-200 triggers endless retries of the same update).
  (Task 3)
- An event or transaction action runs for a user with no connection at all (a brand-new
  account, zero connections, marking a personal event) — `notifyConnectionMembers` must
  short-circuit without ever touching the database, not throw. (Task 2)
- A connection member who is *not* the owner of a `telegram_link_codes` row — whether
  already connected or only mid-invitation — must get zero rows back when querying another
  user's code, proving the RLS fix actually holds (this is the specific hole the
  builder-check review found in the original, rejected column-revoke design). (Task 1)

---

## Task 1: Migrations, Realtime Publication, and Security/Smoke Verification

**Files:**
- Create: `supabase/migrations/0009_telegram_link.sql`
- Create: `supabase/migrations/0010_realtime.sql`
- Create: `scripts/apply-migration.mjs`
- Create: `scripts/verify-telegram-link-security.mjs`
- Create: `scripts/verify-realtime-smoke.mjs`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: table `public.telegram_link_codes (user_id uuid primary key, code text not null
  unique, created_at timestamptz not null default now())` with RLS policies scoping all of
  select/insert/update/delete to `user_id = auth.uid()`; `events`, `transactions`,
  `profiles` added to the `supabase_realtime` publication. Tasks 2-6 all depend on this
  table and this publication existing in the remote database before their own manual
  verification steps can pass.

- [ ] **Step 1: Write `supabase/migrations/0009_telegram_link.sql`**

```sql
create table public.telegram_link_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.telegram_link_codes enable row level security;

create policy "telegram_link_codes_select_own" on public.telegram_link_codes
  for select using (user_id = auth.uid());

create policy "telegram_link_codes_insert_own" on public.telegram_link_codes
  for insert with check (user_id = auth.uid());

create policy "telegram_link_codes_update_own" on public.telegram_link_codes
  for update using (user_id = auth.uid());

create policy "telegram_link_codes_delete_own" on public.telegram_link_codes
  for delete using (user_id = auth.uid());
```

- [ ] **Step 2: Write `supabase/migrations/0010_realtime.sql`**

```sql
alter publication supabase_realtime add table public.events, public.transactions, public.profiles;
```

- [ ] **Step 3: Write `scripts/apply-migration.mjs`**

```javascript
import { readFileSync } from "node:fs";
import { Client } from "pg";
import assert from "node:assert/strict";

const file = process.argv[2];
assert(file, "usage: node scripts/apply-migration.mjs <path-to-migration.sql>");
const sql = readFileSync(file, "utf8");

const dbUrl = process.env.SUPABASE_DB_URL;
assert(dbUrl, "SUPABASE_DB_URL must be set");

const client = new Client({ connectionString: dbUrl });
await client.connect();
try {
  await client.query(sql);
  console.log(`Applied ${file}`);
} finally {
  await client.end();
}
```

- [ ] **Step 4: Apply both migrations**

Run: `node scripts/apply-migration.mjs supabase/migrations/0009_telegram_link.sql`
Expected: prints `Applied supabase/migrations/0009_telegram_link.sql`, exits 0.

Run: `node scripts/apply-migration.mjs supabase/migrations/0010_realtime.sql`
Expected: prints `Applied supabase/migrations/0010_realtime.sql`, exits 0.

- [ ] **Step 5: Write `scripts/verify-telegram-link-security.mjs` (Review Focus: RLS isolation)**

Modeled directly on `scripts/verify-phase1.mjs`'s `asUser` role-switching helper (same
`set local role authenticated` + `request.jwt.claims` technique) so it exercises the real
RLS policies, not application-layer assumptions:

```javascript
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
assert(
  url && serviceKey && dbUrl,
  "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_URL must be set"
);

const admin = createClient(url, serviceKey);
const client = new Client({ connectionString: dbUrl });
await client.connect();

const runId = `${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-9);
const emailFor = (n) => `e2e-tg-${runId}-${n}@example.com`;
const createdUserIds = [];
let createdConnectionId = null;

async function createTestUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  assert.equal(error, null, `createUser(${email}) failed: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id };
}

async function asUser(userId, fn) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query(
      "select set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, true)",
      [userId]
    );
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}

try {
  const { id: userAId } = await createTestUser(emailFor("a"));
  const { id: userBId } = await createTestUser(emailFor("b"));

  const { data: connection } = await admin.from("connections").insert({}).select().single();
  createdConnectionId = connection.id;
  await admin.from("connection_members").insert([
    { connection_id: connection.id, user_id: userAId },
    { connection_id: connection.id, user_id: userBId },
  ]);

  await asUser(userAId, () =>
    client.query("insert into public.telegram_link_codes (user_id, code) values ($1, $2)", [
      userAId,
      "secret-code-a",
    ])
  );

  const bReadsA = await asUser(userBId, () =>
    client.query("select code from public.telegram_link_codes where user_id = $1", [userAId])
  );
  assert.equal(
    bReadsA.rows.length,
    0,
    "a connected partner must NOT be able to read another user's telegram link code"
  );

  const aReadsOwn = await asUser(userAId, () =>
    client.query("select code from public.telegram_link_codes where user_id = $1", [userAId])
  );
  assert.equal(
    aReadsOwn.rows[0]?.code,
    "secret-code-a",
    "the owner must still be able to read their own code"
  );

  console.log("Telegram link code RLS check: PASS");
} finally {
  if (createdConnectionId) {
    await admin.from("connections").delete().eq("id", createdConnectionId);
  }
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
  await client.end();
}
```

- [ ] **Step 6: Run the security verification script**

Run: `node scripts/verify-telegram-link-security.mjs`
Expected: prints `Telegram link code RLS check: PASS`, exits 0.

- [ ] **Step 7: Write `scripts/verify-realtime-smoke.mjs` (early Realtime check, before any consumer is built)**

```javascript
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && serviceKey, "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

const admin = createClient(url, serviceKey);

let received = false;
const channel = admin
  .channel("verify-realtime-smoke")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, () => {
    received = true;
  })
  .subscribe();

await new Promise((resolve) => setTimeout(resolve, 2000));

const { data: user } = await admin.auth.admin.createUser({
  email: `rt-smoke-${Date.now()}@example.com`,
  email_confirm: true,
});

const { data: inserted } = await admin
  .from("events")
  .insert({
    owner_id: user.user.id,
    created_by: user.user.id,
    title: "realtime smoke test",
    all_day: true,
    start_at: new Date().toISOString(),
  })
  .select()
  .single();

await new Promise((resolve) => setTimeout(resolve, 3000));

await admin.from("events").delete().eq("id", inserted.id);
await admin.auth.admin.deleteUser(user.user.id);
await channel.unsubscribe();

assert.ok(
  received,
  "expected a postgres_changes event for the INSERT on events — Realtime publication may not be active"
);
console.log("Realtime smoke test: PASS");
process.exit(0);
```

- [ ] **Step 8: Run the Realtime smoke test**

Run: `node scripts/verify-realtime-smoke.mjs`
Expected: prints `Realtime smoke test: PASS`, exits 0. If this fails, stop and diagnose
Realtime configuration (project plan tier, publication state) before continuing to Task 6 —
building two page-level subscriptions on top of a non-functioning publication would hide the
same root cause behind more code.

- [ ] **Step 9: Add the new env var names to `.env.local.example`**

Append (no values — same placeholder style as the existing four lines):
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
```

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/0009_telegram_link.sql supabase/migrations/0010_realtime.sql scripts/apply-migration.mjs scripts/verify-telegram-link-security.mjs scripts/verify-realtime-smoke.mjs .env.local.example
git commit -m "feat: add telegram_link_codes table, realtime publication, and verification scripts"
```

---

## Task 2: Telegram Notification Core (pure message builders, sender, connection fan-out)

**Files:**
- Create: `src/lib/telegram/messages.ts`
- Create: `src/lib/telegram/messages.test.ts`
- Create: `src/lib/telegram/send-message.ts`
- Create: `src/lib/telegram/send-message.test.ts`
- Create: `src/lib/telegram/notify-connection.ts`
- Create: `src/lib/telegram/notify-connection.test.ts`

**Interfaces:**
- Produces: `eventNotificationMessage(input: { action: "created" | "updated" | "deleted";
  actorName: string; title: string; startAt: string; allDay: boolean }): string`;
  `transactionNotificationMessage(input: { action: "created" | "updated" | "deleted";
  actorName: string; type: "expense" | "income"; amount: number; categoryName: string }):
  string`; `sendTelegramMessage(chatId: string, text: string): Promise<void>`;
  `notifyConnectionMembers(supabase: SupabaseClient<Database>, params: { connectionId:
  string | null; excludeUserId: string; message: string }): Promise<void>` — Task 5 calls
  all four of these by these exact names.

- [ ] **Step 1: Write failing tests for `eventNotificationMessage` and `transactionNotificationMessage`**

```typescript
import { describe, it, expect } from "vitest";
import { eventNotificationMessage, transactionNotificationMessage } from "./messages";

describe("eventNotificationMessage", () => {
  it("builds a created message with a time for a timed event", () => {
    expect(
      eventNotificationMessage({
        action: "created",
        actorName: "민지",
        title: "저녁 약속",
        startAt: "2026-10-20T09:00:00.000Z",
        allDay: false,
      })
    ).toBe("민지님이 일정을 등록했어요: 저녁 약속 (10월 20일 09:00)");
  });

  it("builds an all-day message without a time", () => {
    expect(
      eventNotificationMessage({
        action: "updated",
        actorName: "민지",
        title: "출장",
        startAt: "2026-10-20T00:00:00.000Z",
        allDay: true,
      })
    ).toBe("민지님이 일정을 수정했어요: 출장 (10월 20일)");
  });

  it("builds a deleted message without a date", () => {
    expect(
      eventNotificationMessage({
        action: "deleted",
        actorName: "민지",
        title: "저녁 약속",
        startAt: "2026-10-20T09:00:00.000Z",
        allDay: false,
      })
    ).toBe("민지님이 일정을 삭제했어요: 저녁 약속");
  });
});

describe("transactionNotificationMessage", () => {
  it("builds a created message", () => {
    expect(
      transactionNotificationMessage({
        action: "created",
        actorName: "민지",
        type: "expense",
        amount: 15000,
        categoryName: "식비",
      })
    ).toBe("민지님이 식비 지출 15,000원을 등록했어요");
  });

  it("builds an updated message", () => {
    expect(
      transactionNotificationMessage({
        action: "updated",
        actorName: "민지",
        type: "income",
        amount: 3000000,
        categoryName: "월급",
      })
    ).toBe("민지님이 월급 수입 내역을 수정했어요: 3,000,000원");
  });

  it("builds a deleted message", () => {
    expect(
      transactionNotificationMessage({
        action: "deleted",
        actorName: "민지",
        type: "expense",
        amount: 12000,
        categoryName: "문화",
      })
    ).toBe("민지님이 문화 지출 내역을 삭제했어요: 12,000원");
  });
});
```

Run: `npm test -- messages` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/lib/telegram/messages.ts`**

Use `date-fns`'s `parseISO` + `format` with pattern `"M월 d일 HH:mm"` for a timed event's
date portion, `"M월 d일"` for an all-day one (both are literal-character patterns, no
`date-fns/locale` import needed). Use `amount.toLocaleString("ko-KR")` for the
comma-separated amount. Type label: `"expense"` → `"지출"`, `"income"` → `"수입"`.

Run: `npm test -- messages` — Expected: PASS.

- [ ] **Step 3: Write failing tests for `sendTelegramMessage` (Review Focus: never throws)**

```typescript
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
```

Run: `npm test -- send-message` — Expected: FAIL.

- [ ] **Step 4: Implement `src/lib/telegram/send-message.ts`**

`sendTelegramMessage(chatId: string, text: string): Promise<void>` POSTs JSON
(`{ chat_id: chatId, text }`) to
`` `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage` ``. Wrap the
whole body in `try/catch`; on either a thrown error or a non-`ok` response, `console.error`
and return — never rethrow.

Run: `npm test -- send-message` — Expected: PASS.

- [ ] **Step 5: Write failing test for `notifyConnectionMembers` (Review Focus: null connectionId never touches the database)**

```typescript
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
```

Run: `npm test -- notify-connection` — Expected: FAIL.

- [ ] **Step 6: Implement `src/lib/telegram/notify-connection.ts`**

`notifyConnectionMembers(supabase, { connectionId, excludeUserId, message })`: return
immediately (before touching `supabase`) if `connectionId` is `null`. Otherwise query
`connection_members` for `connection_id = connectionId` and `user_id <> excludeUserId`,
joined to `profiles(telegram_chat_id)` (same join-via-FK shape already used in
`src/app/[locale]/(app)/settings/page.tsx`), filter out null `telegram_chat_id`, and call
`sendTelegramMessage` for each via `Promise.allSettled` (one recipient's failure must not
affect another's, and `sendTelegramMessage` itself never throws per Task 2 Step 4 anyway).

Run: `npm test -- notify-connection` — Expected: PASS.

- [ ] **Step 7: Run full suite**

Run: `npm test` — Expected: all tests pass (Phase 1-3 tests + Task 1's new scripts are not
part of `npm test` + these 3 new files).

- [ ] **Step 8: Commit**

```bash
git add src/lib/telegram/messages.ts src/lib/telegram/messages.test.ts src/lib/telegram/send-message.ts src/lib/telegram/send-message.test.ts src/lib/telegram/notify-connection.ts src/lib/telegram/notify-connection.test.ts
git commit -m "feat: add telegram message builders, sender, and connection notify fan-out"
```

---

## Task 3: Telegram Linking Backend (service client, Server Actions, webhook route)

**Files:**
- Create: `src/lib/supabase/service.ts`
- Create: `src/lib/telegram/webhook-auth.ts`
- Create: `src/lib/telegram/webhook-auth.test.ts`
- Create: `src/lib/telegram/parse-start-command.ts`
- Create: `src/lib/telegram/parse-start-command.test.ts`
- Create: `src/lib/actions/telegram.ts`
- Create: `src/app/api/telegram/webhook/route.ts`

**Interfaces:**
- Consumes: `sendTelegramMessage` (Task 2).
- Produces: `createServiceClient(): SupabaseClient<Database>`;
  `isValidWebhookSecret(headerValue: string | null): boolean`;
  `parseStartCommand(text: string): string | null`; `export type TelegramLinkState = { url?:
  string; error?: string }`; `generateTelegramLinkCode(): Promise<TelegramLinkState>`;
  `unlinkTelegram(): Promise<{ error?: string }>` — Task 4's Settings UI calls the last two
  by these exact names.

- [ ] **Step 1: Write `src/lib/supabase/service.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 2: Write failing tests for `isValidWebhookSecret` (Review Focus: webhook auth boundary)**

```typescript
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
```

Run: `npm test -- webhook-auth` — Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/telegram/webhook-auth.ts`**

`isValidWebhookSecret(headerValue: string | null): boolean` returns
`headerValue !== null && headerValue === process.env.TELEGRAM_WEBHOOK_SECRET`.

Run: `npm test -- webhook-auth` — Expected: PASS.

- [ ] **Step 4: Write failing tests for `parseStartCommand` (Review Focus: malformed `/start`)**

```typescript
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
```

Run: `npm test -- parse-start-command` — Expected: FAIL.

- [ ] **Step 5: Implement `src/lib/telegram/parse-start-command.ts`**

`parseStartCommand(text: string): string | null` matches `/^\/start (\S+)$/` against
`text.trim()` and returns the captured group, or `null` if it doesn't match.

Run: `npm test -- parse-start-command` — Expected: PASS.

- [ ] **Step 6: Write `src/lib/actions/telegram.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";

export type TelegramLinkState = { url?: string; error?: string };

export async function generateTelegramLinkCode(): Promise<TelegramLinkState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { error } = await supabase
    .from("telegram_link_codes")
    .upsert({ user_id: user.id, code });
  if (error) return { error: error.message };

  return { url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}` };
}

export async function unlinkTelegram(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ telegram_chat_id: null })
    .eq("id", user.id);
  if (error) return { error: error.message };

  await supabase.from("telegram_link_codes").delete().eq("user_id", user.id);
  return {};
}
```

- [ ] **Step 7: Write `src/app/api/telegram/webhook/route.ts`**

```typescript
import { createServiceClient } from "@/lib/supabase/service";
import { isValidWebhookSecret } from "@/lib/telegram/webhook-auth";
import { parseStartCommand } from "@/lib/telegram/parse-start-command";
import { sendTelegramMessage } from "@/lib/telegram/send-message";

export async function POST(request: Request) {
  if (!isValidWebhookSecret(request.headers.get("X-Telegram-Bot-Api-Secret-Token"))) {
    return new Response("unauthorized", { status: 401 });
  }

  const update = await request.json();
  const text = update?.message?.text as string | undefined;
  const chatId = update?.message?.chat?.id as number | undefined;
  const code = text ? parseStartCommand(text) : null;

  if (code && chatId) {
    const supabase = createServiceClient();
    const { data: linkRow } = await supabase
      .from("telegram_link_codes")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();

    if (linkRow) {
      await supabase
        .from("profiles")
        .update({ telegram_chat_id: String(chatId) })
        .eq("id", linkRow.user_id);
      await supabase.from("telegram_link_codes").delete().eq("user_id", linkRow.user_id);
      await sendTelegramMessage(String(chatId), "다붓 계정과 연결됐어요!");
    } else {
      await sendTelegramMessage(String(chatId), "연결 코드를 찾을 수 없어요");
    }
  }

  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 8: Verify it compiles**

Run: `npm run build` — Expected: exits 0 (no dedicated test for the route itself — its two
decision points, the secret check and the `/start` parsing, are already unit-tested in
Steps 2-5; the route is thin glue over them plus DB calls, consistent with how
`src/lib/actions/events.ts` has no dedicated test either).

- [ ] **Step 9: Run full suite**

Run: `npm test` — Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/supabase/service.ts src/lib/telegram/webhook-auth.ts src/lib/telegram/webhook-auth.test.ts src/lib/telegram/parse-start-command.ts src/lib/telegram/parse-start-command.test.ts src/lib/actions/telegram.ts src/app/api/telegram/webhook/route.ts
git commit -m "feat: add telegram linking server actions and webhook route"
```

---

## Task 4: Settings UI — Telegram Linking Section

**Files:**
- Create: `src/components/settings/telegram-link.tsx`
- Modify: `src/app/[locale]/(app)/settings/page.tsx`
- Modify: `messages/ko.json`, `messages/en.json`, `messages/zh.json` (add a `telegram` namespace)

**Interfaces:**
- Consumes: `generateTelegramLinkCode`, `unlinkTelegram` (Task 3).
- Produces: `<TelegramLink connected={boolean} />` (calls `generateTelegramLinkCode`/
  `unlinkTelegram` itself — it needs no data from its parent beyond the current linked
  status) — this task's own Settings page integration is the only consumer; no later task
  depends on this component.

- [ ] **Step 1: Add the `telegram` message namespace**

`messages/ko.json`:
```json
"telegram": {
  "title": "텔레그램 연동",
  "connected": "연결됨",
  "notConnected": "연결 안 됨",
  "connectButton": "연결하기",
  "disconnectButton": "연결 해제"
}
```

`messages/en.json`:
```json
"telegram": {
  "title": "Telegram",
  "connected": "Connected",
  "notConnected": "Not connected",
  "connectButton": "Connect",
  "disconnectButton": "Disconnect"
}
```

`messages/zh.json`:
```json
"telegram": {
  "title": "Telegram 关联",
  "connected": "已连接",
  "notConnected": "未连接",
  "connectButton": "连接",
  "disconnectButton": "断开连接"
}
```

- [ ] **Step 2: Write `src/components/settings/telegram-link.tsx`**

Client component. `useTranslations("telegram")`. Props: `{ connected: boolean }` plus two
callbacks the parent wires to the Server Actions directly (parent already owns the
`userId`/Supabase client pattern, per Step 3 below): a "연결하기" button (shown when
`!connected`) that calls `generateTelegramLinkCode()` and, on a returned `url`,
`window.open(url, "_blank")`; a "연결 해제" button (shown when `connected`) that calls
`unlinkTelegram()`. Render "연결됨"/"연결 안 됨" text based on `connected`.

- [ ] **Step 3: Wire it into `src/app/[locale]/(app)/settings/page.tsx`**

Add a `telegramConnected` state (`useState<boolean>(false)`), set it from the existing
`userId`-driven `useEffect`'s profile fetch (add `telegram_chat_id` to whatever `profiles`
select already happens there, or add a small new one-off `.from("profiles").select(
"telegram_chat_id").eq("id", userId).single()` call alongside the existing effects). Add a
second `useEffect` (once `userId` is known) that opens a Realtime subscription:
`supabase.channel("profile-" + userId).on("postgres_changes", { event: "UPDATE", schema:
"public", table: "profiles", filter: "id=eq." + userId }, (payload) =>
setTelegramConnected(!!payload.new.telegram_chat_id)).subscribe()`, unsubscribed in the
effect's cleanup. Render `<TelegramLink connected={telegramConnected} />` below
`ConnectionManager`.

- [ ] **Step 4: Verify it compiles**

Run: `npm run build` — Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/telegram-link.tsx "src/app/[locale]/(app)/settings/page.tsx" messages
git commit -m "feat: add telegram linking section to settings with live status"
```

---

## Task 5: Wire CRUD Notifications into Events & Transactions Actions

**Files:**
- Modify: `src/lib/actions/events.ts`
- Modify: `src/lib/actions/transactions.ts`

**Interfaces:**
- Consumes: `eventNotificationMessage`, `transactionNotificationMessage`,
  `notifyConnectionMembers` (Task 2).
- Produces: nothing later tasks depend on — `events.ts`/`transactions.ts`'s existing
  exported function names and signatures (`createEvent`, `updateEvent`, `deleteEvent`,
  `createTransaction`, `updateTransaction`, `deleteTransaction`) are unchanged.

- [ ] **Step 1: Add a shared actor-name helper**

In both files (or a tiny shared `src/lib/telegram/actor-name.ts` if the implementer prefers
— builder's call, either is fine since it's two call sites), resolve the acting user's
display name via `supabase.from("profiles").select("display_name, email").eq("id",
user.id).single()`, falling back to the email's local part (`email.split("@")[0]`) when
`display_name` is empty. This is a new convention for this phase (see the design doc —
`display_name` is currently write-only elsewhere in the app).

- [ ] **Step 2: Wire notifications into `createEvent`/`updateEvent`/`deleteEvent`**

After each successful `.insert()`/`.update()`/`.delete()` (i.e. after the existing `if
(error) return { error: error.message };` check passes), call
`notifyConnectionMembers(supabase, { connectionId, excludeUserId: user.id, message:
eventNotificationMessage({ action: "created" | "updated" | "deleted", actorName, title,
startAt: timestamps.startAt, allDay: timestamps.allDay }) })` — do not `await` it in a way
that blocks the response if that changes response time noticeably; a plain `await` is fine
since `notifyConnectionMembers` itself never throws (Task 2), it just returns once all
`Promise.allSettled` sends resolve. `deleteEvent` changes its delete call from
`.delete().eq("id", eventId)` to `.delete().eq("id", eventId).select().single()` so the
deleted row's `title`, `connection_id`, `start_at`, `all_day` are available for the message
(Postgres returns the deleted row via `DELETE ... RETURNING`, which is what `.select()`
compiles to — no extra read).

- [ ] **Step 3: Wire notifications into `createTransaction`/`updateTransaction`/`deleteTransaction`**

Same pattern: after a successful write, fetch the category name (`supabase.from(
"categories").select("name").eq("id", categoryId).single()` — `updateTransaction`/
`deleteTransaction` don't currently have `categoryId` in scope for the delete path, so
`deleteTransaction` also changes to `.delete().eq("id", transactionId).select("*,
categories(name)").single()` to get both the deleted row and its category name in one
round trip), then call `notifyConnectionMembers(supabase, { connectionId, excludeUserId:
user.id, message: transactionNotificationMessage({ action, actorName, type, amount,
categoryName }) })`.

- [ ] **Step 4: Verify it compiles**

Run: `npm run build` — Expected: exits 0.

- [ ] **Step 5: Run full suite**

Run: `npm test` — Expected: all tests still pass (no existing test touches these files'
internals directly, per Phase 3's own note that they're untested glue — this step confirms
nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/events.ts src/lib/actions/transactions.ts
git commit -m "feat: send telegram notifications on event and transaction CRUD"
```

---

## Task 6: Realtime Page Wiring (Calendar & Ledger)

**Files:**
- Create: `src/components/realtime/realtime-refresh.tsx`
- Modify: `src/app/[locale]/(app)/calendar/page.tsx`
- Modify: `src/app/[locale]/(app)/ledger/page.tsx`

**Interfaces:**
- Produces: `<RealtimeRefresh table="events" | "transactions" />` — this task's own two page
  integrations are the only consumers; no later task depends on this component.

- [ ] **Step 1: Write `src/components/realtime/realtime-refresh.tsx`**

Client component. Props: `{ table: "events" | "transactions" }`. On mount, open
`createClient().channel("refresh-" + table).on("postgres_changes", { event: "*", schema:
"public", table }, () => { /* debounced */ router.refresh() }).subscribe()` (`router` from
`next/navigation`'s `useRouter`, not the locale-aware `@/i18n/navigation` one — refreshing
the current route doesn't need locale awareness). Debounce with a 300ms `setTimeout`
cleared on each new event, so a burst of changes triggers one refresh. Unsubscribe the
channel in the effect's cleanup. Renders `null`.

- [ ] **Step 2: Mount it in the calendar and ledger pages**

In `src/app/[locale]/(app)/calendar/page.tsx`, render `<RealtimeRefresh table="events" />`
alongside the existing `<ViewToggle />`/`<Link>`/view components. In
`src/app/[locale]/(app)/ledger/page.tsx`, render `<RealtimeRefresh table="transactions" />`
alongside its existing totals/list markup.

- [ ] **Step 3: Verify it compiles**

Run: `npm run build` — Expected: exits 0.

- [ ] **Step 4: Manual two-session verification**

Run: `npm run dev`. With Task 1's Realtime smoke test already green, this step only checks
the page-level wiring: open the calendar page in two browser sessions signed in as
connected test accounts, create a shared event in one, and confirm the other's calendar
updates within ~1 second without a manual reload. Repeat for the ledger page with a
transaction. (Same honesty note as every prior phase: if no second real account/session is
available when this plan is executed, say so rather than claiming a check that didn't
happen.)

- [ ] **Step 5: Commit**

```bash
git add src/components/realtime "src/app/[locale]/(app)/calendar/page.tsx" "src/app/[locale]/(app)/ledger/page.tsx"
git commit -m "feat: add realtime refresh to calendar and ledger pages"
```

---

## Task 7: Webhook Registration Script and End-to-End Verification

**Files:**
- Create: `scripts/telegram-setup-webhook.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks (it's an operational script, run once by the human
  partner, not imported by app code).
- Produces: nothing later tasks depend on — this is the plan's last task.

- [ ] **Step 1: Write `scripts/telegram-setup-webhook.mjs`**

```javascript
import assert from "node:assert/strict";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
assert(token && secret, "TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be set");

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: "https://dabut.vercel.app/api/telegram/webhook",
    secret_token: secret,
  }),
});

const result = await response.json();
console.log(result);
assert(result.ok, "setWebhook failed — see the response above");
console.log("Webhook registered.");
```

- [ ] **Step 2: Commit**

```bash
git add scripts/telegram-setup-webhook.mjs
git commit -m "feat: add one-time telegram webhook registration script"
```

- [ ] **Step 3: Human partner runs the registration script**

This step is not executable by the agent session (it requires `TELEGRAM_BOT_TOKEN`, which
per the Global Constraints is never entered into this session). The human partner runs,
locally, after Task 3's webhook route is deployed to `https://dabut.vercel.app`:

```bash
node scripts/telegram-setup-webhook.mjs
```

Expected: logs `{ ok: true, ... }` then `Webhook registered.`.

- [ ] **Step 4: Full end-to-end manual verification (human partner + agent, real accounts)**

1. From Settings, click "연결하기", open the returned Telegram deep link, send `/start
   <code>` in Telegram, confirm the bot replies "다붓 계정과 연결됐어요!" and Settings flips to
   "연결됨" without a manual reload (Task 4's Realtime subscription).
2. Create an event as one connected test account; confirm the Telegram message arrives for
   the other account's linked chat, and that account's open calendar tab updates live
   (Task 6).
3. Repeat for updating and deleting an event, and for creating/updating/deleting a
   transaction.
4. Send a garbled `/start` (no code, or a code that was already consumed) directly to the
   bot and confirm it replies gracefully instead of going silent or erroring (Review Focus,
   Task 3).

This is the plan's only step that cannot be verified without a live Telegram bot and two
real linked accounts — note explicitly if it could not be run when this plan is executed,
rather than claiming it passed.

# Dabut Phase 4 — Telegram Notifications & Realtime Sync (Design)

**Status:** approved for planning (superpowers:writing-plans next)
**Spec:** `requirements.md` §3.1 (텔레그램 연동), §3.2/§3.3 (CRUD 알림, 양방향 동기화), §4 Phase 4.

## Intent & Why

Phase 3 gave the connected pair working calendar/ledger CRUD, but changes are silent and
local to whoever made them — the partner only sees a new event or expense after manually
reloading the page, and never gets pinged on their phone. Phase 4 closes that loop: every
event/transaction CRUD pushes a Telegram message to the other connection member(s), and
every connected client's calendar/ledger view updates live via Supabase Realtime without a
manual refresh.

## Goals

- A user can link their Telegram account to their Dabut profile from Settings, with no
  manual chat-id lookup.
- Creating, updating, or deleting an event or a transaction sends a Telegram message to
  every *other* member of the connection the row belongs to (if they're linked).
- The calendar and ledger pages reflect a partner's change without a manual reload.
- The whole thing is verifiable end-to-end against the real Telegram Bot API and the real
  (already-provisioned) Vercel deployment at `https://dabut.vercel.app` — not mocked.

## Non-Goals

- Notification preferences / per-category opt-out. One linked chat = all CRUD notifications.
- Delivery guarantees. A failed Telegram API call is logged and dropped — it never blocks
  or rolls back the underlying CRUD action.
- Notification batching/digests. One message per action.
- Fine-grained optimistic Realtime UI patching. A relevant Postgres change triggers a full
  `router.refresh()` of the current page; no client-side cache surgery.
- Rich/interactive Telegram messages (buttons, mini-app). Plain text only.
- Automating Telegram webhook registration or Vercel secret upload from inside this agent
  session — both involve entering a bot token into a system, which this session's safety
  rules reserve for the human partner. A one-time local script is provided instead (see
  "Left to the builder").

## Anti-Goals (would make this a failure even if "done")

- A Telegram notification call ever causing a CRUD action to fail or roll back.
- The webhook endpoint accepting unauthenticated requests (anyone could forge a chat-id
  link for an arbitrary user).
- Realtime updates leaking a row to a client RLS wouldn't otherwise let them read.

## Constraints

- `profiles.telegram_chat_id` already exists (Phase 1 migration `0001_profiles.sql`) and is
  unused until now.
- No phone numbers anywhere (email is the identifier, per the Phase 1 mid-project change).
- Existing Server Actions (`src/lib/actions/events.ts`, `src/lib/actions/transactions.ts`)
  already resolve a `connection_id` for *every* event (personal or shared) and *every*
  transaction (`connection_id not null`) — Phase 4 notifications piggyback on that, so a
  "personal" event still notifies the partner, matching how it already appears on their
  unified calendar as a "partner" event.
- The Vercel project is linked and deployed (`dabut`, production URL `https://dabut.vercel.app`,
  confirmed publicly reachable with no auth wall). GitHub repo `kimyonghoo/dabut` is
  connected for future pushes.
- `TELEGRAM_BOT_TOKEN` exists (user has it) but has not been given to this session and
  will not be: entering API tokens into any system is a hard rule this session does not
  override, even on request. The human partner sets it directly in Vercel and in their
  local `.env.local` themselves.
- How Phase 1-3 migrations were actually applied to the remote Supabase project is not
  recorded, but `scripts/verify-phase1.mjs` proves a working, already-used pattern exists:
  a Node script connecting directly to `SUPABASE_DB_URL` via the `pg` package (already a
  dependency). The new migration is applied the same way — a small script that reads a
  migration file and runs it through a `pg.Client` — rather than manual copy-paste into the
  Supabase Dashboard SQL Editor. This also means applying it does not require entering any
  credential anywhere: `SUPABASE_DB_URL` is already sitting in `.env.local`, unchanged from
  how `verify-phase1.mjs` already uses it.

## Decided Architecture

### 1. Telegram account linking (deep-link + webhook)

- **Migration** (new file, `supabase/migrations/0009_telegram_link.sql`): add a **new table**
  `telegram_link_codes (user_id uuid primary key references profiles(id) on delete cascade,
  code text not null unique, created_at timestamptz not null default now())`, RLS enabled,
  with only an owner-scoped policy (`user_id = auth.uid()`) for select/insert/update — no
  "connected member can see" or "pending invitation" policy at all.
  **Security correction from builder-check review, revised:** the original idea (a
  `telegram_link_code` column directly on `profiles`, locked down with a column-level
  `revoke select (...)`) turns out not to actually work on this project — Supabase's default
  project setup grants `authenticated` table-wide `SELECT` on `public.profiles` (no
  migration here ever issues an explicit `grant`, confirming it's the Supabase-provisioned
  default), and Postgres column-level `REVOKE` cannot subtract from an existing table-level
  `GRANT`: the column stays readable regardless. Putting the code in its own table with its
  own RLS sidesteps that Postgres grant quirk entirely and is the more idiomatic fix: a
  connection member or pending-invitation counterpart can still see the rest of `profiles`
  (unchanged, by design — `profiles_select_connected` /
  `profiles_select_pending_connection`), but has no policy giving them any access
  whatsoever to another user's `telegram_link_codes` row. This is what actually satisfies
  the Anti-Goal below.
- **Settings UI** gets a new "텔레그램 연동" section: shows "연결됨" / "연결 안 됨" based on
  `profiles.telegram_chat_id`, a "연결하기" button when not linked, and a "연결 해제" button
  when linked. It also live-updates when the webhook finishes linking out-of-band — see the
  Realtime section below (builder-check review flagged that without this, a user who links
  via the Telegram app and returns to an already-open Settings tab sees stale "연결 안 됨"
  until a manual reload).
- **Server Action** `generateTelegramLinkCode()` (`src/lib/actions/telegram.ts`): generates
  the code in JS (`crypto.randomUUID()`-derived), `upsert`s
  `{ user_id: user.id, code }` into `telegram_link_codes`, and returns
  `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}` using the value it already holds in
  memory — never reading it back from the database. `TELEGRAM_BOT_USERNAME` is a new
  (non-secret) env var.
- **Server Action** `unlinkTelegram()`: nulls `profiles.telegram_chat_id` and deletes the
  user's `telegram_link_codes` row (if any) for the current user.
- **Webhook route** `src/app/api/telegram/webhook/route.ts` (POST, already excluded from
  the next-intl middleware matcher — no code change needed there):
  1. Reject unless the `X-Telegram-Bot-Api-Secret-Token` header matches
     `process.env.TELEGRAM_WEBHOOK_SECRET` (new secret env var) — this is the auth
     boundary, since Telegram webhooks are otherwise unauthenticated POSTs.
  2. Parse the Telegram `Update` JSON body. If `message.text` matches `/^\/start (\S+)$/`,
     look up the `code` against `telegram_link_codes.code` using a service-role Supabase
     client (no end-user session exists in a webhook request; service role also bypasses
     the owner-only RLS on this table, which is exactly why the webhook — not a normal
     user session — is the only code path allowed to resolve a code to its owner).
  3. On match: set `profiles.telegram_chat_id = message.chat.id` for that `user_id`, delete
     the `telegram_link_codes` row (one-time use), reply with a confirmation message. On no
     match (expired/already-used code): reply with a plain "연결 코드를 찾을 수 없어요"
     message; still return 200 to Telegram either way (a non-200 makes Telegram retry the
     same update repeatedly).
- **One-time local setup script** `scripts/telegram-setup-webhook.mjs` (run by the user,
  `node scripts/telegram-setup-webhook.mjs`, reading `TELEGRAM_BOT_TOKEN` /
  `TELEGRAM_WEBHOOK_SECRET` from their own `.env.local`): calls Telegram's `setWebhook` API
  pointing at `https://dabut.vercel.app/api/telegram/webhook` with the secret token. This
  keeps the bot token out of this session entirely.

### 2. Outbound CRUD notifications

- `src/lib/telegram/send-message.ts` — `sendTelegramMessage(chatId, text)`: POSTs to
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`. Catches and logs any
  error; never throws (Review Focus: a Telegram outage must never fail a CRUD action).
- `src/lib/telegram/messages.ts` — pure, unit-tested message builders:
  `eventNotificationMessage({ action: "created"|"updated"|"deleted", actorName, title, startAt })`
  and `transactionNotificationMessage({ action, actorName, type, amount, categoryName })`,
  returning plain Korean strings (app is Korean-first; i18n of notification text is out of
  scope — Settings/UI chrome stays translated, push text doesn't).
- `src/lib/telegram/notify-connection.ts` — `notifyConnectionMembers(supabase, { connectionId, excludeUserId, message })`:
  no-ops if `connectionId` is null; otherwise selects other `connection_members` joined to
  `profiles.telegram_chat_id`, and fire-and-forgets `sendTelegramMessage` to each non-null
  chat id via `Promise.allSettled` (one member's failure doesn't block another's).
- Wired into `createEvent`/`updateEvent`/`deleteEvent` and `createTransaction`/
  `updateTransaction`/`deleteTransaction` after the DB write succeeds. `deleteEvent`/
  `deleteTransaction` change from `.delete().eq(...)` to `.delete().eq(...).select().single()`
  so the deleted row's `title`/`connection_id` (or `amount`/`category_id`) is available to
  build the message — the row is gone from the table but Postgres returns the deleted row
  to a `DELETE ... RETURNING` (what `.select()` compiles to), so no extra read is needed.
  The actor's display name comes from `supabase.from("profiles").select("display_name, email")`
  for `user.id`, falling back to the email local-part when `display_name` is empty — this is
  a new convention, not an existing one (builder-check review found `display_name` is
  currently write-only: it defaults to `''` and nothing in the app ever sets it yet), so
  state it as a fresh decision for this phase rather than "matching existing behavior."

### 3. Supabase Realtime

- **Migration** (same `0009_telegram_link.sql`, or a second `0010_realtime.sql` — builder's
  call): `alter publication supabase_realtime add table events, transactions, profiles;`.
  Default replica identity (primary key) is enough — every consumer below only uses a
  change notification as a cue to refetch, never reads the changed columns out of the
  Realtime payload itself.
- Realtime respects RLS using the subscribing client's JWT (Supabase's documented behavior
  for Realtime Authorization), so no manual `connection_id` filter is needed client-side —
  a user simply never receives a change event for a row RLS wouldn't let them `select`.
  (`profiles` already restricts `select` to "self, or a connected/pending-invitation
  counterpart" — adding it to the publication doesn't change who can read what, only that a
  readable row's changes now also arrive live. `telegram_link_codes` is deliberately *not*
  added to this publication — nobody but the webhook's service-role client ever needs to
  react to it changing.)
- **Early smoke test, before building either consumer** (builder-check review: this project
  has no confirmed history of Realtime actually working end-to-end here, unlike the
  migration-application question which at least has 8 prior migrations as a precedent).
  Immediately after applying the publication change, open a throwaway subscription (e.g.
  the Supabase Dashboard's Realtime inspector, or a five-line disposable script) against
  `events` and confirm one real INSERT fires a `postgres_changes` event before writing
  `realtime-refresh.tsx` or wiring either page. A silent failure here (wrong plan tier,
  publication not actually active, etc.) is much cheaper to catch now than after both pages
  and the Settings subscription are built on top of it.
- **Client component** `src/components/realtime/realtime-refresh.tsx` (`"use client"`):
  takes a `table: "events" | "transactions"` prop, opens one Supabase Realtime channel for
  `postgres_changes` on that table (`event: "*"`), and calls `router.refresh()` (plain
  `next/navigation`, not the locale-aware wrapper — refreshing doesn't need locale
  awareness) on every event, debounced ~300ms so a burst of changes doesn't thrash. Renders
  nothing (`return null`). Mounted once each in `calendar/page.tsx` (`table="events"`) and
  `ledger/page.tsx` (`table="transactions"`) — scoped per page so being on the ledger page
  doesn't refetch calendar data and vice versa.
- **Settings live-update** (closes the gap builder-check review found): the Settings page
  already fetches `userId`/connections/invitations client-side via `useEffect`
  (`src/app/[locale]/(app)/settings/page.tsx`). Add one more subscription there — on
  `postgres_changes` for `profiles` filtered to `id=eq.${userId}` — that refetches just the
  current user's `telegram_chat_id` and flips the "연결됨" state. This is the one place in
  Phase 4 where a Realtime event drives a targeted state update instead of a full
  `router.refresh()`, because Settings is a client component with local state already, not
  a Server Component page.
- Review Focus: confirm a second browser session (or second real account) sees a newly
  created shared event appear within a couple of seconds without touching F5, and that
  linking Telegram flips Settings to "연결됨" on its own after returning from the Telegram
  app.

## Left to the Builder

- Exact random-code generation for `telegram_link_codes.code` (length, charset) — anything
  resistant to guessing within the link's short practical lifetime is fine; this is a
  convenience guard, not the sole auth boundary (the webhook secret token plus
  `telegram_link_codes`' owner-only RLS together are).
- Whether `0009`/`0010` are one migration file or two.
- Exact Korean copy for notification messages and the Settings "텔레그램 연동" section
  (follow the existing terse style already used in `messages/ko.json`).
- Debounce duration for `realtime-refresh.tsx` (300ms suggested, not mandated).

## What the Human Partner Still Needs To Do

1. Add three env vars directly in the Vercel dashboard (or via `vercel env add` in their
   own terminal, as already done for the Supabase keys): `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_BOT_USERNAME` (not secret, but simplest to keep alongside the others),
   `TELEGRAM_WEBHOOK_SECRET` (any random string they pick). Same three in `.env.local` for
   local dev.
2. After the webhook route is deployed, run `node scripts/telegram-setup-webhook.mjs`
   locally once to register the webhook with Telegram.
3. ~~Paste the new migration's SQL into the Supabase SQL Editor~~ — not needed; the plan
   applies it with a script against the already-present `SUPABASE_DB_URL`.
4. Do the real end-to-end check: link their own Telegram from Settings, confirm the bot
   replies, then have both test accounts create/edit/delete an event and a transaction and
   confirm the Telegram message arrives and the other account's open tab updates live.

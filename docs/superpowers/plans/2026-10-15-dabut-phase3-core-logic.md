# Dabut Phase 3 — Core Business Logic (Calendar & Ledger) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 2 calendar/ledger placeholders with real CRUD, backed by Server Actions, so a connected pair can log personal/shared events and shared transactions and see them correctly categorized and rendered in both a month-grid and a thread/timeline view.

**Architecture:** Each entity (events, transactions, connections) gets a thin `"use server"` actions file that validates input via a pure, unit-tested helper and then performs one typed Supabase write; RLS (already in place from Phase 1) is the only authorization boundary, so actions never need their own permission checks beyond "is there a session." Calendar rendering splits into pure data-shaping functions (`categorizeEvent`, `getMonthGridDays`, `groupEventsByDate`) consumed by two presentational view components behind one toggle. A minimal connection-management UI (search by email, invite, accept) is added to the existing Settings page, since "같이 하는 일정" has no meaning without a connection to share it with and no other phase currently builds this UI.

**Tech Stack:** `date-fns` 4.4.0 (new — month-grid and date-range arithmetic by hand is error-prone; no other date lib exists in the project). Everything else reuses Phase 1/2: typed Supabase clients, Next.js Server Actions + `useActionState`, next-intl navigation, Tailwind `bg-brand`/`text-brand`.

**Spec:** `D:\Dabut\requirements.md` — this plan implements §3.2 (Shared Calendar) and §3.3 (Shared Account Book) in full, plus the minimal slice of §3.1 (search-by-email invite + accept) needed to make "같이 하는 일정" possible. Telegram notifications (§3.2/§3.3's notification bullets) and Supabase Realtime are explicitly Phase 4 — writes happen, no push/live-sync.

## Global Constraints

- 일정 입력 항목: 언제(When), 어디서(Where), 누구랑(Who) — requirements.md §3.2.
- 시간 설정: '하루 종일', '시간 단위(시작~종료)', '날짜 단위(기간)' — requirements.md §3.2. The `events` table (Phase 1) has no separate "mode" column; this plan derives mode from `all_day` + whether `start_at`/`end_at` fall on the same calendar day, pinned exactly in Task 1.
- 통합 달력: 내 개인 일정 / 상대방의 개인 일정 / 공통 일정을 색상·뱃지로 구분 — requirements.md §3.2.
- 달력 뷰 ↔ 스레드 뷰 토글 — requirements.md §3.2.
- 가계부 기본 카테고리 (이미 Phase 1에서 시드됨, 변경 없음): 지출 — 식비/육아/문화/경조사, 수입 — 월급.
- No Telegram, no Supabase Realtime, no phone-number anything (identifier is email, per the Phase 1 mid-project change) anywhere in this plan.

## Review Focus

- A user with zero connections tries to mark an event "같이 하는 일정" — the shared checkbox/picker must be disabled or absent, not silently save as `visibility: 'shared'` with a null `connection_id` (which the Phase 1 `events_shared_requires_connection` check constraint would reject anyway, but the UI should prevent the confusing DB error from ever surfacing).
- An event's `timeRange` mode where the end time is before the start time on the same day, or `dateRange` mode where the end date is before the start date — a reasonable person expects a validation error, not a silently-inverted or garbage date range.
- Two events on the same day, one spanning midnight (a `dateRange` event starting yesterday) — the month-grid must show it on every day it spans, not just its `start_at` day.
- A transaction amount of `0`, a negative number, or non-numeric input typed into the amount field — must show a client-visible error before ever reaching the Phase 1 `amount > 0` DB constraint.
- Accepting an invitation that is no longer pending (already accepted/declined by a race, e.g. double-click) — `accept_connection_invitation`'s existing `raise exception` must surface as a readable UI error, not an unhandled 500.

---

## Task 1: Pure Calendar/Ledger Logic

**Files:**
- Create: `src/lib/calendar/categorize-event.ts`
- Create: `src/lib/calendar/categorize-event.test.ts`
- Create: `src/lib/calendar/month-grid.ts`
- Create: `src/lib/calendar/month-grid.test.ts`
- Create: `src/lib/calendar/group-by-date.ts`
- Create: `src/lib/calendar/group-by-date.test.ts`
- Create: `src/lib/events/build-event-timestamps.ts`
- Create: `src/lib/events/build-event-timestamps.test.ts`
- Create: `src/lib/events/validate-shared-selection.ts`
- Create: `src/lib/events/validate-shared-selection.test.ts`
- Create: `src/lib/ledger/calculate-totals.ts`
- Create: `src/lib/ledger/calculate-totals.test.ts`
- Modify: `package.json` (add `date-fns`)

**Interfaces:**
- Produces: `categorizeEvent(event: { owner_id: string; visibility: "personal" | "shared" }, currentUserId: string): "mine" | "partner" | "shared"`; `getMonthGridDays(month: Date): Date[]` (always a multiple of 7, starts on Sunday, ends on Saturday, covers every day of `month`); `groupEventsByDate<T extends { start_at: string }>(events: T[]): Array<{ date: string; events: T[] }>` (date as `"yyyy-MM-dd"`, groups sorted ascending, events within a group sorted by `start_at` ascending); `buildEventTimestamps(input: { mode: "allDay" | "timeRange" | "dateRange"; startDate: string; startTime?: string; endDate?: string; endTime?: string }): { allDay: boolean; startAt: string; endAt: string | null } | { error: string }`; `validateSharedSelection(isShared: boolean, connectionId: string | null): { error: string } | null` (Review Focus: a "shared" event with no connection selected must be rejected before it ever reaches the DB's `events_shared_requires_connection` check constraint, with a readable message instead of a raw Postgres error); `calculateMonthlyTotals(transactions: Array<{ type: "expense" | "income"; amount: number }>): { income: number; expense: number; net: number }`. Tasks 2-8 all consume these by these exact names.

- [ ] **Step 1: Add `date-fns` to `package.json` dependencies**

`"date-fns": "^4.4.0"`. Run `npm install`.

- [ ] **Step 2: Write failing tests for `categorizeEvent`**

```typescript
import { describe, it, expect } from "vitest";
import { categorizeEvent } from "./categorize-event";

describe("categorizeEvent", () => {
  it("returns 'shared' for a shared event regardless of owner", () => {
    expect(categorizeEvent({ owner_id: "me", visibility: "shared" }, "me")).toBe("shared");
    expect(categorizeEvent({ owner_id: "partner", visibility: "shared" }, "me")).toBe("shared");
  });
  it("returns 'mine' for my own personal event", () => {
    expect(categorizeEvent({ owner_id: "me", visibility: "personal" }, "me")).toBe("mine");
  });
  it("returns 'partner' for a connection member's personal event", () => {
    expect(categorizeEvent({ owner_id: "partner", visibility: "personal" }, "me")).toBe("partner");
  });
});
```

Run: `npm test -- categorize-event` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `categorizeEvent` in `src/lib/calendar/categorize-event.ts`**

Visibility `"shared"` always wins regardless of owner; otherwise compare `owner_id` to `currentUserId`.

Run: `npm test -- categorize-event` — Expected: PASS.

- [ ] **Step 4: Write failing tests for `getMonthGridDays`**

```typescript
import { describe, it, expect } from "vitest";
import { getMonthGridDays } from "./month-grid";

describe("getMonthGridDays", () => {
  it("returns a multiple of 7 days", () => {
    const days = getMonthGridDays(new Date(2026, 9, 1)); // October 2026
    expect(days.length % 7).toBe(0);
  });
  it("starts on a Sunday and ends on a Saturday", () => {
    const days = getMonthGridDays(new Date(2026, 9, 1));
    expect(days[0].getDay()).toBe(0);
    expect(days[days.length - 1].getDay()).toBe(6);
  });
  it("covers every day of the given month", () => {
    const days = getMonthGridDays(new Date(2026, 9, 1));
    const oct1 = days.find((d) => d.getFullYear() === 2026 && d.getMonth() === 9 && d.getDate() === 1);
    const oct31 = days.find((d) => d.getFullYear() === 2026 && d.getMonth() === 9 && d.getDate() === 31);
    expect(oct1).toBeDefined();
    expect(oct31).toBeDefined();
  });
});
```

Run: `npm test -- month-grid` — Expected: FAIL.

- [ ] **Step 5: Implement `getMonthGridDays` in `src/lib/calendar/month-grid.ts`**

Use `date-fns`' `startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek` (both default to week starting Sunday), `eachDayOfInterval`.

Run: `npm test -- month-grid` — Expected: PASS.

- [ ] **Step 6: Write failing tests for `groupEventsByDate`**

```typescript
import { describe, it, expect } from "vitest";
import { groupEventsByDate } from "./group-by-date";

describe("groupEventsByDate", () => {
  it("groups events by their start_at calendar date, sorted ascending", () => {
    const events = [
      { id: "c", start_at: "2026-10-16T09:00:00Z" },
      { id: "a", start_at: "2026-10-15T08:00:00Z" },
      { id: "b", start_at: "2026-10-15T20:00:00Z" },
    ];
    const grouped = groupEventsByDate(events);
    expect(grouped.map((g) => g.date)).toEqual(["2026-10-15", "2026-10-16"]);
    expect(grouped[0].events.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
```

Run: `npm test -- group-by-date` — Expected: FAIL.

- [ ] **Step 7: Implement `groupEventsByDate` in `src/lib/calendar/group-by-date.ts`**

Use `date-fns`' `format(parseISO(event.start_at), "yyyy-MM-dd")` as the grouping key.

Run: `npm test -- group-by-date` — Expected: PASS.

- [ ] **Step 8: Write failing tests for `buildEventTimestamps` (Review Focus: inverted ranges)**

```typescript
import { describe, it, expect } from "vitest";
import { buildEventTimestamps } from "./build-event-timestamps";

describe("buildEventTimestamps", () => {
  it("builds an all-day event spanning just startDate", () => {
    const result = buildEventTimestamps({ mode: "allDay", startDate: "2026-10-15" });
    expect(result).toEqual({ allDay: true, startAt: "2026-10-15T00:00:00.000Z", endAt: null });
  });
  it("builds a same-day time range", () => {
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "09:00",
      endTime: "10:30",
    });
    expect(result).toEqual({
      allDay: false,
      startAt: "2026-10-15T09:00:00.000Z",
      endAt: "2026-10-15T10:30:00.000Z",
    });
  });
  it("rejects a time range where end is before start", () => {
    const result = buildEventTimestamps({
      mode: "timeRange",
      startDate: "2026-10-15",
      startTime: "10:30",
      endTime: "09:00",
    });
    expect(result).toEqual({ error: "End time must be after start time" });
  });
  it("builds a multi-day date range", () => {
    const result = buildEventTimestamps({ mode: "dateRange", startDate: "2026-10-15", endDate: "2026-10-17" });
    expect(result).toEqual({
      allDay: true,
      startAt: "2026-10-15T00:00:00.000Z",
      endAt: "2026-10-17T00:00:00.000Z",
    });
  });
  it("rejects a date range where end is before start", () => {
    const result = buildEventTimestamps({ mode: "dateRange", startDate: "2026-10-17", endDate: "2026-10-15" });
    expect(result).toEqual({ error: "End date must be on or after start date" });
  });
});
```

Note: these tests assume the local timezone is UTC (so `"2026-10-15" + "00:00" local` serializes to `"2026-10-15T00:00:00.000Z"`). If running in a non-UTC environment makes this test flaky, pin `TZ=UTC` in the `test` script in `package.json` rather than loosening the assertions — the point is exact, deterministic timestamps.

Run: `npm test -- build-event-timestamps` — Expected: FAIL.

- [ ] **Step 9: Implement `buildEventTimestamps` in `src/lib/events/build-event-timestamps.ts`**

Parse `startDate`/`endDate` as local-midnight `Date`s (`new Date(\`${dateStr}T00:00:00\`)`), combine `startDate`+`startTime`/`endTime` similarly for `timeRange`, and call `.toISOString()` for the returned strings. Validate the two Review Focus cases before constructing the success value.

Run: `npm test -- build-event-timestamps` — Expected: PASS.

- [ ] **Step 10: Write failing tests for `validateSharedSelection` (Review Focus: shared event with no connection)**

```typescript
import { describe, it, expect } from "vitest";
import { validateSharedSelection } from "./validate-shared-selection";

describe("validateSharedSelection", () => {
  it("rejects a shared event with no connection selected", () => {
    expect(validateSharedSelection(true, null)).toEqual({ error: "Select a connection to share with" });
  });
  it("accepts a shared event with a connection selected", () => {
    expect(validateSharedSelection(true, "conn-1")).toBeNull();
  });
  it("accepts a personal (non-shared) event with no connection", () => {
    expect(validateSharedSelection(false, null)).toBeNull();
  });
});
```

Run: `npm test -- validate-shared-selection` — Expected: FAIL.

- [ ] **Step 11: Implement `validateSharedSelection` in `src/lib/events/validate-shared-selection.ts`**

Run: `npm test -- validate-shared-selection` — Expected: PASS.

- [ ] **Step 12: Write failing tests for `calculateMonthlyTotals`**

```typescript
import { describe, it, expect } from "vitest";
import { calculateMonthlyTotals } from "./calculate-totals";

describe("calculateMonthlyTotals", () => {
  it("sums income and expense separately and computes net", () => {
    const totals = calculateMonthlyTotals([
      { type: "income", amount: 3000000 },
      { type: "expense", amount: 50000 },
      { type: "expense", amount: 12000 },
    ]);
    expect(totals).toEqual({ income: 3000000, expense: 62000, net: 2938000 });
  });
  it("returns zeros for an empty list", () => {
    expect(calculateMonthlyTotals([])).toEqual({ income: 0, expense: 0, net: 0 });
  });
});
```

Run: `npm test -- calculate-totals` — Expected: FAIL.

- [ ] **Step 13: Implement `calculateMonthlyTotals` in `src/lib/ledger/calculate-totals.ts`**

Run: `npm test -- calculate-totals` — Expected: PASS.

- [ ] **Step 14: Run full suite**

Run: `npm test` — Expected: all tests pass (previous Phase 2 tests + these 6 new files).

- [ ] **Step 15: Commit**

```bash
git add src/lib/calendar src/lib/events src/lib/ledger package.json package-lock.json
git commit -m "feat: add pure calendar/ledger data-shaping and validation logic"
```

---

## Task 2: Connections — Search, Invite, Accept

**Files:**
- Create: `src/lib/actions/connections.ts`
- Create: `src/components/connections/connection-manager.tsx`
- Modify: `src/app/[locale]/(app)/settings/page.tsx`
- Modify: `messages/ko.json`, `messages/en.json`, `messages/zh.json` (add a `connections` namespace)

**Interfaces:**
- Consumes: `search_profile_by_email` RPC and `accept_connection_invitation` RPC (Phase 1); `createClient()` from `src/lib/supabase/server.ts`.
- Produces: Server Actions `searchProfileByEmail(_prevState: { results?: Array<{ id: string; display_name: string }>; error?: string }, formData: FormData)`, `sendConnectionInvitation(inviteeId: string): Promise<{ error?: string }>`, `acceptConnectionInvitation(invitationId: string): Promise<{ error?: string }>` from `src/lib/actions/connections.ts` — Task 4's `EventForm` consumes a *list* of the current user's connections (fetched directly in the calendar page's Server Component via a plain `supabase.from("connections")...` join, not through these actions — these three actions are for the Settings page only).

- [ ] **Step 1: Add the `connections` message namespace**

Each of `messages/{ko,en,zh}.json` gets a new top-level key:

```json
"connections": {
  "searchLabel": "이메일로 상대방 찾기",
  "searchPlaceholder": "email@example.com",
  "searchButton": "검색",
  "invite": "초대 보내기",
  "pendingReceived": "받은 초대",
  "pendingSent": "보낸 초대",
  "accept": "수락",
  "connectedWith": "연결됨"
}
```

(Translate values for `en`/`zh`; keep the same key tree.)

- [ ] **Step 2: Write `src/lib/actions/connections.ts`**

```typescript
"use server";

export type SearchState = { results?: Array<{ id: string; display_name: string }>; error?: string };

export async function searchProfileByEmail(_prevState: SearchState, formData: FormData): Promise<SearchState> {
  // createClient() from "@/lib/supabase/server", call .rpc("search_profile_by_email", { target_email: formData.get("email") })
}

export async function sendConnectionInvitation(inviteeId: string): Promise<{ error?: string }> {
  // insert into connection_invitations (inviter_id: current user, invitee_id: inviteeId)
  // on Postgres error (e.g. already connected, per Phase 1's RLS insert-policy check), return { error: error.message }
}

export async function acceptConnectionInvitation(invitationId: string): Promise<{ error?: string }> {
  // supabase.rpc("accept_connection_invitation", { target_invitation_id: invitationId })
  // on error (e.g. "invitation not found or not pending" — Review Focus item), return { error: error.message }
}
```

Get the current user's id for `inviter_id` via `supabase.auth.getUser()` inside the action (same pattern as `(app)/layout.tsx`).

- [ ] **Step 3: Write `src/components/connections/connection-manager.tsx`**

Client component. Three sections:
1. Email search form (`useActionState(searchProfileByEmail, {})`), rendering `results` with an "초대 보내기" button per result calling `sendConnectionInvitation(result.id)`.
2. Received pending invitations (passed in as a prop `receivedInvitations: Array<{ id: string; inviterEmail: string }>` — fetched server-side by the parent page) with an "수락" button calling `acceptConnectionInvitation(invitation.id)`.
3. Current connections (prop `connections: Array<{ id: string; partnerEmail: string }>`) rendered as a plain read-only list.

Use `useTranslations("connections")` for all labels.

- [ ] **Step 4: Wire `ConnectionManager` into the Settings page**

In `src/app/[locale]/(app)/settings/page.tsx` (currently a client component from Phase 2 — leave it a client component, but it cannot itself do the server-side joins needed for `receivedInvitations`/`connections`; fetch both client-side in a `useEffect` via `createClient()` from `src/lib/supabase/client.ts`, mirroring the existing `userId` effect already in this file):
- `receivedInvitations`: `.from("connection_invitations").select("id, inviter_id, profiles!connection_invitations_inviter_id_fkey(email)").eq("status", "pending")` filtered to invitations where the current user is the invitee (RLS already restricts to rows where you're inviter or invitee — filter client-side or with `.eq("invitee_id", userId)`).
- `connections`: join `connection_members` (own row) to find `connection_id`s, then the other member's `profiles.email` per connection.

Render `<ConnectionManager />` with these props below the existing theme/brand-color controls.

- [ ] **Step 5: Manual verification**

Run: `npm run build` — Expected: exits 0.
Run: `npm run dev`, sign up two accounts, search account B by email from account A's settings page, send an invite, log in as B, confirm the pending invitation appears and accepting it succeeds (no 500 — Review Focus item for a now-invalid double-accept: click accept twice rapidly, confirm the second click surfaces `error: "invitation not found or not pending"` rather than crashing).

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/connections.ts src/components/connections src/app/\[locale\]/\(app\)/settings/page.tsx messages
git commit -m "feat: add connection search/invite/accept to settings"
```

---

## Task 3: Events Server Actions

**Files:**
- Create: `src/lib/actions/events.ts`

**Interfaces:**
- Consumes: `buildEventTimestamps`, `validateSharedSelection` (Task 1); `createClient()` from `src/lib/supabase/server.ts`.
- Produces: `export type EventActionState = { error?: string }`; `createEvent(_prevState: EventActionState, formData: FormData): Promise<EventActionState>`; `updateEvent(eventId: string, _prevState: EventActionState, formData: FormData): Promise<EventActionState>`; `deleteEvent(eventId: string): Promise<EventActionState>` — Task 4's `EventForm` binds `updateEvent`/`createEvent` via `useActionState`, and calls `deleteEvent` directly.

- [ ] **Step 1: Write `src/lib/actions/events.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildEventTimestamps } from "@/lib/events/build-event-timestamps";
import { validateSharedSelection } from "@/lib/events/validate-shared-selection";

export type EventActionState = { error?: string };

async function parseAndBuild(formData: FormData): Promise<ReturnType<typeof buildEventTimestamps> | { error: string }> {
  const mode = formData.get("mode") as "allDay" | "timeRange" | "dateRange";
  return buildEventTimestamps({
    mode,
    startDate: formData.get("startDate") as string,
    startTime: (formData.get("startTime") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
    endTime: (formData.get("endTime") as string) || undefined,
  });
}

export async function createEvent(_prevState: EventActionState, formData: FormData): Promise<EventActionState> {
  const timestamps = await parseAndBuild(formData);
  if ("error" in timestamps) return timestamps;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Title is required" };

  const isShared = formData.get("shared") === "on";
  const connectionId = (formData.get("connectionId") as string) || null;
  const sharedError = validateSharedSelection(isShared, connectionId);
  if (sharedError) return sharedError;

  const { error } = await supabase.from("events").insert({
    owner_id: user.id,
    created_by: user.id,
    connection_id: connectionId,
    visibility: isShared ? "shared" : "personal",
    title,
    location: (formData.get("location") as string) || null,
    companions: (formData.get("companions") as string) || null,
    all_day: timestamps.allDay,
    start_at: timestamps.startAt,
    end_at: timestamps.endAt,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}
```

`updateEvent(eventId, _prevState, formData)` mirrors `createEvent` but calls `.update({...}).eq("id", eventId)` and skips `created_by` (unchanged). `deleteEvent(eventId)` calls `.from("events").delete().eq("id", eventId)`, revalidates, returns `{ error: error.message }` on failure or `{}` on success.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build` — Expected: exits 0 (no dedicated test — this file is thin glue over the already-tested `buildEventTimestamps`; DB behavior is covered by Phase 1's RLS tests and this task's manual check in Task 4).

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/events.ts
git commit -m "feat: add events Server Actions"
```

---

## Task 4: Event Form + Create/Edit Routes

**Files:**
- Create: `src/components/events/event-form.tsx`
- Create: `src/app/[locale]/(app)/calendar/new/page.tsx`
- Create: `src/app/[locale]/(app)/calendar/[id]/edit/page.tsx`
- Modify: `messages/ko.json`, `messages/en.json`, `messages/zh.json` (add an `events` namespace)

**Interfaces:**
- Consumes: `createEvent`, `updateEvent`, `deleteEvent` (Task 3).
- Produces: `<EventForm mode="create" connections={...} />` / `<EventForm mode="edit" event={...} connections={...} />` — this task's own two route pages are the only consumers; no later task depends on this component.

- [ ] **Step 1: Add the `events` message namespace**

```json
"events": {
  "title": "제목",
  "location": "어디서",
  "companions": "누구랑",
  "modeAllDay": "하루 종일",
  "modeTimeRange": "시간 단위",
  "modeDateRange": "날짜 단위(기간)",
  "shared": "같이 하는 일정",
  "noConnection": "연결된 상대가 없습니다. 설정에서 먼저 연결하세요.",
  "save": "저장",
  "delete": "삭제"
}
```

- [ ] **Step 2: Write `src/components/events/event-form.tsx`**

Client component, `useActionState(mode === "create" ? createEvent : updateEvent.bind(null, event!.id), {})`. Fields: title, location, companions (text inputs), a `mode` radio group (`allDay`/`timeRange`/`dateRange`) toggling which of startDate/startTime/endDate/endTime inputs render, a `shared` checkbox that — when `connections.length === 0` — is replaced by the `events.noConnection` message instead of a disabled checkbox (Review Focus item: no silent invalid state), and a `connectionId` `<select>` shown only when `shared` is checked and `connections.length > 0`. In edit mode, render a "삭제" button calling `deleteEvent(event.id)` directly (not through `useActionState`, it has no form fields).

- [ ] **Step 3: Write `src/app/[locale]/(app)/calendar/new/page.tsx`**

Server Component. Fetch the current user's connections the same way Task 2 Step 4 does for Settings (reuse the query shape, inlined — this is a 5-line Supabase join, not worth its own shared helper yet). Render `<EventForm mode="create" connections={connections} />`.

- [ ] **Step 4: Write `src/app/[locale]/(app)/calendar/[id]/edit/page.tsx`**

Server Component. `params: Promise<{ id: string }>`. Fetch the event by id (RLS ensures only owner/connection-member can read it; if the fetch returns no row, call `notFound()` from `next/navigation`) and the connections list, render `<EventForm mode="edit" event={event} connections={connections} />`.

- [ ] **Step 5: Verify it compiles**

Run: `npm run build` — Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/events src/app/\[locale\]/\(app\)/calendar/new src/app/\[locale\]/\(app\)/calendar/\[id\] messages
git commit -m "feat: add event create/edit form and routes"
```

---

## Task 5: Calendar Page — Month & Thread Views

**Files:**
- Create: `src/components/calendar/month-view.tsx`
- Create: `src/components/calendar/thread-view.tsx`
- Create: `src/components/calendar/view-toggle.tsx`
- Modify: `src/app/[locale]/(app)/calendar/page.tsx`
- Modify: `messages/ko.json`, `messages/en.json`, `messages/zh.json` (add `calendar` namespace)

**Interfaces:**
- Consumes: `categorizeEvent`, `getMonthGridDays`, `groupEventsByDate` (Task 1); `Link` from `src/i18n/navigation.ts`.
- Produces: nothing later tasks depend on — this is the last calendar-side task.

- [ ] **Step 1: Add the `calendar` message namespace**

```json
"calendar": {
  "monthView": "달력",
  "threadView": "스레드",
  "newEvent": "+ 일정 추가",
  "categoryMine": "내 일정",
  "categoryPartner": "상대방 일정",
  "categoryShared": "공통 일정"
}
```

- [ ] **Step 2: Write `src/components/calendar/view-toggle.tsx`**

Client component. Reads the current `view` search param (`useSearchParams` from `next/navigation` — plain, not the locale-aware one, since search params aren't locale-specific) defaulting to `"month"`, renders two buttons (`calendar.monthView` / `calendar.threadView`) that `router.push` (from `@/i18n/navigation`) to the same pathname with `?view=month` / `?view=thread`, highlighting the active one with `bg-brand`.

- [ ] **Step 3: Write `src/components/calendar/month-view.tsx`**

Presentational, no "use client" needed unless it has interactivity beyond links. Props: `{ month: Date; events: Array<EventRow & { category: "mine" | "partner" | "shared" }> }`. Uses `getMonthGridDays(month)` to render a 7-column grid; for each day, find events where the day falls within `[start_at, end_at ?? start_at]` inclusive (Review Focus item: a multi-day `dateRange` event must render on every day it spans, not just `start_at`'s day) and render a small badge per event colored/labeled by `category` (e.g. `mine` → `bg-brand`, `partner`/`shared` → distinct Tailwind colors of the implementer's choice — the spec requires three visually distinct markers, not specific colors).

- [ ] **Step 4: Write `src/components/calendar/thread-view.tsx`**

Presentational. Props: `{ events: Array<EventRow & { category: "mine" | "partner" | "shared" }> }`. Uses `groupEventsByDate(events)` and renders a date-header-plus-list layout, same category badges as `month-view.tsx`.

- [ ] **Step 5: Rewrite `src/app/[locale]/(app)/calendar/page.tsx`**

Server Component. `searchParams: Promise<{ view?: string }>`. Fetch the current user (`auth.getUser()`), their events (`.from("events").select("*")` — RLS already scopes this to own + connection-member events), map each through `categorizeEvent(event, user.id)`, and render `<ViewToggle />`, a `<Link href="/calendar/new">{t("newEvent")}</Link>`, and either `<MonthView>` or `<ThreadView>` based on `searchParams.view`.

- [ ] **Step 6: Run full suite + build**

Run: `npm test && npm run build` — Expected: all pass, exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/calendar "src/app/[locale]/(app)/calendar/page.tsx" messages
git commit -m "feat: wire calendar page with month/thread views"
```

---

## Task 6: Transactions Server Actions

**Files:**
- Create: `src/lib/ledger/validate-amount.ts`
- Create: `src/lib/ledger/validate-amount.test.ts`
- Create: `src/lib/actions/transactions.ts`

**Interfaces:**
- Produces: `validateAmount(raw: string): { amount: number } | { error: string }`; `export type TransactionActionState = { error?: string }`; `createTransaction(_prevState: TransactionActionState, formData: FormData): Promise<TransactionActionState>`; `updateTransaction(transactionId: string, _prevState: TransactionActionState, formData: FormData): Promise<TransactionActionState>`; `deleteTransaction(transactionId: string): Promise<TransactionActionState>` — Task 7's `TransactionForm` consumes these by name.

- [ ] **Step 1: Write failing tests for `validateAmount` (Review Focus: zero/negative/non-numeric)**

```typescript
import { describe, it, expect } from "vitest";
import { validateAmount } from "./validate-amount";

describe("validateAmount", () => {
  it("accepts a positive number", () => {
    expect(validateAmount("12000")).toEqual({ amount: 12000 });
  });
  it("rejects zero", () => {
    expect(validateAmount("0")).toEqual({ error: "Amount must be greater than 0" });
  });
  it("rejects a negative number", () => {
    expect(validateAmount("-500")).toEqual({ error: "Amount must be greater than 0" });
  });
  it("rejects non-numeric input", () => {
    expect(validateAmount("abc")).toEqual({ error: "Amount must be greater than 0" });
  });
});
```

Run: `npm test -- validate-amount` — Expected: FAIL.

- [ ] **Step 2: Implement `validateAmount` in `src/lib/ledger/validate-amount.ts`**

`Number(raw)`; treat `NaN` the same as `<= 0`.

Run: `npm test -- validate-amount` — Expected: PASS.

- [ ] **Step 3: Write `src/lib/actions/transactions.ts`**

Same shape as `src/lib/actions/events.ts` (Task 3): `createTransaction` resolves the current user, the user's `connection_id` (a transaction always needs one — Phase 1's schema has `connection_id` as `not null`; if the user has zero connections, return `{ error: "Select a connection first" }` before attempting the insert), calls `validateAmount(formData.get("amount"))`, and inserts `{ connection_id, owner_id: user.id, created_by: user.id, category_id: formData.get("categoryId"), type: formData.get("type"), amount, memo: formData.get("memo") || null, occurred_at: formData.get("occurredAt") }`. `updateTransaction`/`deleteTransaction` mirror `updateEvent`/`deleteEvent`. All three call `revalidatePath("/", "layout")` on success.

- [ ] **Step 4: Run full suite + build**

Run: `npm test && npm run build` — Expected: all pass, exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ledger/validate-amount.ts src/lib/ledger/validate-amount.test.ts src/lib/actions/transactions.ts
git commit -m "feat: add transactions Server Actions"
```

---

## Task 7: Transaction Form + Create/Edit Routes

**Files:**
- Create: `src/components/ledger/transaction-form.tsx`
- Create: `src/app/[locale]/(app)/ledger/new/page.tsx`
- Create: `src/app/[locale]/(app)/ledger/[id]/edit/page.tsx`
- Modify: `messages/ko.json`, `messages/en.json`, `messages/zh.json` (add a `ledger` namespace)

**Interfaces:**
- Consumes: `createTransaction`, `updateTransaction`, `deleteTransaction` (Task 6).
- Produces: `<TransactionForm mode="create" categories={...} />` / `<TransactionForm mode="edit" transaction={...} categories={...} />`.

- [ ] **Step 1: Add the `ledger` message namespace**

```json
"ledger": {
  "type": "수입/지출",
  "expense": "지출",
  "income": "수입",
  "category": "카테고리",
  "amount": "금액",
  "memo": "메모",
  "occurredAt": "날짜",
  "save": "저장",
  "delete": "삭제",
  "newTransaction": "+ 내역 추가",
  "income_total": "수입 합계",
  "expense_total": "지출 합계",
  "net_total": "순액"
}
```

- [ ] **Step 2: Write `src/components/ledger/transaction-form.tsx`**

Client component, `useActionState(mode === "create" ? createTransaction : updateTransaction.bind(null, transaction!.id), {})`. Fields: `type` (radio, `expense`/`income`), `categoryId` (`<select>` from the `categories` prop, filtered client-side to match the selected `type`), `amount` (number input), `memo` (text), `occurredAt` (date input, default today). Edit mode gets a "삭제" button calling `deleteTransaction(transaction.id)` directly.

- [ ] **Step 3: Write `src/app/[locale]/(app)/ledger/new/page.tsx`**

Server Component. Fetch `categories` (`.from("categories").select("*")` — RLS already returns global defaults plus any connection-scoped ones). Render `<TransactionForm mode="create" categories={categories} />`.

- [ ] **Step 4: Write `src/app/[locale]/(app)/ledger/[id]/edit/page.tsx`**

Server Component, same `notFound()`-on-missing-row pattern as the event edit page (Task 4 Step 4).

- [ ] **Step 5: Verify it compiles**

Run: `npm run build` — Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/ledger src/app/\[locale\]/\(app\)/ledger/new src/app/\[locale\]/\(app\)/ledger/\[id\] messages
git commit -m "feat: add transaction create/edit form and routes"
```

---

## Task 8: Ledger Page — List & Totals

**Files:**
- Modify: `src/app/[locale]/(app)/ledger/page.tsx`

**Interfaces:**
- Consumes: `calculateMonthlyTotals` (Task 1).
- Produces: nothing later tasks depend on — this is the plan's last task.

- [ ] **Step 1: Rewrite `src/app/[locale]/(app)/ledger/page.tsx`**

Server Component. Fetch the current user's transactions for the current calendar month (`.from("transactions").select("*, categories(name)").gte("occurred_at", <first of month>).lte("occurred_at", <last of month>)` — RLS scopes to the user's connection(s)), compute `calculateMonthlyTotals(transactions)`, and render: the three totals (`ledger.income_total` / `expense_total` / `net_total`), a `<Link href="/ledger/new">{t("newTransaction")}</Link>`, and a plain list of transactions (category name, amount, memo, occurred date, each linking to `/ledger/[id]/edit`).

- [ ] **Step 2: Run full suite + build**

Run: `npm test && npm run build` — Expected: all pass, exits 0.

- [ ] **Step 3: Manual verification of the whole Phase 3 slice**

Run: `npm run dev`. As a connected pair of test accounts: create a personal event, a shared event, and a few transactions; confirm the month view shows all three categories distinctly, the thread view groups by date, toggling between them doesn't lose data, and the ledger totals match hand-calculated sums. (Same browser-automation caveat as Phase 2 applies if no browser tool is available when this plan is executed — note it honestly rather than claiming a visual check that didn't happen.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/(app)/ledger/page.tsx"
git commit -m "feat: wire ledger page with transaction list and totals"
```

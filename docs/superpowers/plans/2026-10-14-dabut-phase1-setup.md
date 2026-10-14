# Dabut Project Initial Setup + Phase 1 (DB Modeling & Supabase Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js + Supabase project skeleton and build the complete Phase 1 database layer (profiles, connections, categories, events, transactions) with Phone Auth enabled and Row Level Security enforced, so later phases can build UI and Server Actions on top of a correct, isolated data model.

**Architecture:** Next.js 15 App Router + TypeScript project with a thin `src/lib/supabase/*` client layer (`@supabase/ssr`). All persistence lives in Supabase Postgres, modeled as five migrations applied in order: `profiles` → `connections` (+ members + invitations) → `categories` → `events` → `transactions`. Every table after `profiles` uses a `SECURITY DEFINER` helper, `is_connection_member(connection_id)`, inside its RLS policies so a user can only ever see rows belonging to a connection (couple/group) they are a member of, or their own rows. Cross-connection writes to `connections`/`connection_members` are blocked entirely at the RLS layer and only possible through a single `SECURITY DEFINER` RPC (`accept_connection_invitation`) that creates both rows atomically — this is the mechanism that prevents a user from forging membership in someone else's connection.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind CSS, Supabase (Postgres, Supabase Auth Phone provider, Row Level Security), `@supabase/supabase-js`, `@supabase/ssr`, Supabase CLI for local dev/migrations.

**Spec:** `D:\Dabut\requirements.md` — this plan implements requirements.md §2 (tech stack), §3.1 (user/connection/phone-search), §3.3 category list (base categories only), and requirements.md §4 Phase 1 bullet list. §3.2/§3.3 business logic (CRUD, notifications), §3.4 (UI/theme/gesture), and §3.5 (i18n UI) are explicitly out of scope for this plan — only the `locale`/`brand_color` columns needed later are created now, no UI.

## Global Constraints

- Identifiers are phone numbers (`auth.users.phone`), per requirements.md §3.1 — no email auth.
- RLS must be enabled on every new table; no table may rely on "deny by default from missing policy" without an explicit comment saying so is intentional (see `connections`/`connection_members` below).
- Schema must support a future group (not just 2-person) connection per requirements.md §3.1 ("Couples/Groups") — model connections as `connections` + `connection_members` (many-to-many), not a 2-column `couples` table.
- Categories must be DB-extensible per requirements.md §3.3 ("DB 확장성 고려") — `categories.connection_id` nullable so later custom categories can be scoped per-connection without a schema change.
- No application code for event/transaction CRUD, Telegram, Realtime, or i18n UI in this plan — that is Phase 2/3/4.
- Local verification requires the Supabase CLI and Docker Desktop (for `supabase start`/local Postgres). If Docker is unavailable in the execution environment, substitute a linked hosted Supabase project and run the same SQL via `supabase db push` + the Supabase SQL Editor / `psql "$DATABASE_URL"`, noted per-task.

## Review Focus

- Phone number format drift between how a user is created and how `search_profile_by_phone` matches it — exact-string equality means `+8210...` vs `010...` never match. Tested in Task 3 by creating two auth users with explicit E.164 phones and asserting exact-match search succeeds and a reformatted variant does not.
- Self-invite or duplicate pending invitations to the same person — tested in Task 4 via the `connection_invitations_no_self` check constraint and the partial unique index on pending pairs.
- A "shared" event with no `connection_id` (orphaned shared event nobody else can ever see) — tested in Task 6 via the `events_shared_requires_connection` check constraint.
- Non-member reading another connection's events/transactions/categories — tested end-to-end in Task 9 with a third, unrelated user expected to get zero rows back from all three tables.
- Zero/negative transaction amounts — tested in Task 7 via the `amount > 0` check constraint.

---

## Task 1: Next.js Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `.gitignore`
- Create: `.env.local.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`

**Interfaces:**
- Produces: a buildable Next.js App Router project (`npm run build` succeeds) that Task 2 adds Supabase client files into under `src/lib/supabase/`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "dabut",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.1.6",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@supabase/supabase-js": "^2.47.10",
    "@supabase/ssr": "^0.5.2"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "@types/node": "^22.10.7",
    "@types/react": "^19.0.7",
    "@types/react-dom": "^19.0.3",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.5.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.18.0",
    "eslint-config-next": "15.1.6"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Write `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Write `postcss.config.mjs`**

```javascript
const config = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};

export default config;
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules
.next
.env*.local
supabase/.branches
supabase/.temp
*.tsbuildinfo
```

- [ ] **Step 7: Write `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 8: Write `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Write `src/app/layout.tsx`**

```tsx
import "./globals.css";

export const metadata = {
  title: "다붓 Dabut",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Write `src/app/page.tsx`**

```tsx
export default function Home() {
  return <main>다붓 (Dabut) — Phase 1 scaffold</main>;
}
```

- [ ] **Step 11: Install and build**

Run: `npm install && npm run build`
Expected: exits 0, `.next` directory produced, no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add package.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs .gitignore .env.local.example src
git commit -m "chore: scaffold Next.js App Router project"
```

---

## Task 2: Supabase CLI Init, Phone Auth Config, and Client Helpers

**Files:**
- Create: `supabase/config.toml` (via `supabase init`, then edited)
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: none (first Supabase-aware task).
- Produces: `createClient()` from `src/lib/supabase/client.ts` (browser, sync) and `createClient()` from `src/lib/supabase/server.ts` (server, `async`, cookie-based) — later phases' Server Actions and Client Components import these by name.

- [ ] **Step 1: Initialize Supabase project config**

Run: `supabase init` (requires Supabase CLI; if not installed, `npm install -g supabase` or see https://supabase.com/docs/guides/cli — note as environment prerequisite, not a code change).
Expected: creates `supabase/config.toml` and `supabase/.gitignore`.

- [ ] **Step 2: Enable Phone Auth in `supabase/config.toml`**

Edit the generated `[auth]` section to:

```toml
[auth]
enable_signup = true
enable_confirmations = false

[auth.sms]
enable_signup = true
enable_confirmations = true
# Local/dev testing uses the CLI's test OTP provider; production requires a real
# provider (e.g. Twilio) configured with secrets, not committed here.
[auth.sms.test_otp]
"+15555550100" = "123456"
```

- [ ] **Step 3: Write `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Write `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; ignored because middleware refreshes sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5: Write `src/lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}
```

- [ ] **Step 6: Write `src/middleware.ts`**

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 7: Verify project still builds**

Run: `npm run build`
Expected: exits 0 (import paths resolve, no type errors).

- [ ] **Step 8: Commit**

```bash
git add supabase/config.toml src/lib/supabase src/middleware.ts .gitignore
git commit -m "feat: init Supabase CLI config with phone auth and SSR client helpers"
```

---

## Task 3: Migration 0001 — `profiles` + Phone Search

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

**Interfaces:**
- Consumes: `auth.users` (built into Supabase).
- Produces: table `public.profiles(id, phone, display_name, telegram_chat_id, brand_color, locale, created_at, updated_at)`; RPC `public.search_profile_by_phone(target_phone text) -> table(id uuid, display_name text)` — Task 4's invitation flow and later phases' "invite by phone" UI call this by name.

- [ ] **Step 1: Write `supabase/migrations/0001_profiles.sql`**

```sql
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  display_name text not null default '',
  telegram_chat_id text,
  brand_color text not null default '#FF6F61',
  locale text not null default 'ko' check (locale in ('ko', 'en', 'zh')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.search_profile_by_phone(target_phone text)
returns table (id uuid, display_name text)
language sql
security definer set search_path = public
stable
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.phone = target_phone
    and p.id <> auth.uid();
$$;

grant execute on function public.search_profile_by_phone(text) to authenticated;
```

- [ ] **Step 2: Apply migrations locally**

Run: `supabase db reset`
Expected: exits 0, output includes applying `0001_profiles.sql`.

- [ ] **Step 3: Verify trigger + exact-match search, including the phone-format pitfall**

Run (`psql "$DATABASE_URL"` against the local DB, default `postgresql://postgres:postgres@127.0.0.1:54322/postgres`):

```sql
insert into auth.users (id, phone, aud, role) values
  ('11111111-1111-1111-1111-111111111111', '+15555550100', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', '+15555550101', 'authenticated', 'authenticated');

select id, phone from public.profiles order by phone;
-- Expected: two rows, phones exactly '+15555550100' and '+15555550101'.

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
select * from public.search_profile_by_phone('+15555550101');
-- Expected: 1 row (user 2).
select * from public.search_profile_by_phone('5555550101');
-- Expected: 0 rows (format mismatch is not a match — confirms the Review Focus risk).
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_profiles.sql
git commit -m "feat(db): add profiles table, auto-provisioning trigger, phone search RPC"
```

---

## Task 4: Migration 0002 — Connections, Membership, Invitations

**Files:**
- Create: `supabase/migrations/0002_connections.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.search_profile_by_phone` (Task 3).
- Produces: tables `public.connections(id, created_at)`, `public.connection_members(connection_id, user_id, joined_at)`, `public.connection_invitations(id, inviter_id, invitee_id, status, created_at, responded_at)`; function `public.is_connection_member(target_connection_id uuid) -> boolean` (Tasks 5–7 use this in every RLS policy); RPC `public.accept_connection_invitation(target_invitation_id uuid) -> uuid` (returns new `connection_id`).

- [ ] **Step 1: Write `supabase/migrations/0002_connections.sql`**

```sql
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.connection_members (
  connection_id uuid not null references public.connections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (connection_id, user_id)
);

create table public.connection_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connection_invitations_no_self check (inviter_id <> invitee_id)
);

create unique index connection_invitations_pending_pair_idx
  on public.connection_invitations (inviter_id, invitee_id)
  where (status = 'pending');

create function public.is_connection_member(target_connection_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.connection_members
    where connection_id = target_connection_id
      and user_id = auth.uid()
  );
$$;

alter table public.connections enable row level security;
alter table public.connection_members enable row level security;
alter table public.connection_invitations enable row level security;

-- Intentional: no insert/update/delete policy on connections or connection_members.
-- The only way to create either is the accept_connection_invitation() RPC below,
-- which runs as SECURITY DEFINER and inserts both rows atomically.

create policy "connections_select_member" on public.connections
  for select using (public.is_connection_member(id));

create policy "connection_members_select_scope" on public.connection_members
  for select using (public.is_connection_member(connection_id));

create policy "connection_invitations_select_involved" on public.connection_invitations
  for select using (inviter_id = auth.uid() or invitee_id = auth.uid());

create policy "connection_invitations_insert_as_inviter" on public.connection_invitations
  for insert with check (inviter_id = auth.uid());

create policy "connection_invitations_update_as_invitee" on public.connection_invitations
  for update using (invitee_id = auth.uid());

create policy "profiles_select_connected" on public.profiles
  for select using (
    exists (
      select 1
      from public.connection_members cm1
      join public.connection_members cm2 on cm1.connection_id = cm2.connection_id
      where cm1.user_id = auth.uid() and cm2.user_id = public.profiles.id
    )
  );

create function public.accept_connection_invitation(target_invitation_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_invitation public.connection_invitations;
  v_connection_id uuid;
begin
  select * into v_invitation
  from public.connection_invitations
  where id = target_invitation_id
    and invitee_id = auth.uid()
    and status = 'pending'
  for update;

  if not found then
    raise exception 'invitation not found or not pending';
  end if;

  insert into public.connections default values
  returning id into v_connection_id;

  insert into public.connection_members (connection_id, user_id)
  values (v_connection_id, v_invitation.inviter_id), (v_connection_id, v_invitation.invitee_id);

  update public.connection_invitations
  set status = 'accepted', responded_at = now()
  where id = target_invitation_id;

  return v_connection_id;
end;
$$;

grant execute on function public.accept_connection_invitation(uuid) to authenticated;
```

- [ ] **Step 2: Apply migrations locally**

Run: `supabase db reset`
Expected: exits 0, applies `0002_connections.sql` after `0001_profiles.sql`.

- [ ] **Step 3: Verify invitation constraints (Review Focus: self-invite / duplicate pending)**

```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

insert into public.connection_invitations (inviter_id, invitee_id)
values ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
-- Expected: ERROR violates check constraint "connection_invitations_no_self"

insert into public.connection_invitations (inviter_id, invitee_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
-- Expected: INSERT 0 1

insert into public.connection_invitations (inviter_id, invitee_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
-- Expected: ERROR duplicate key value violates unique constraint "connection_invitations_pending_pair_idx"
```

- [ ] **Step 4: Verify accept flow creates membership and profile visibility**

```sql
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
select public.accept_connection_invitation(
  (select id from public.connection_invitations where inviter_id = '11111111-1111-1111-1111-111111111111' and status = 'pending')
);
-- Expected: returns a new connection uuid.

select count(*) from public.connection_members;
-- Expected: 2

select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111';
-- Expected: now visible to user 2 (was previously blocked by profiles_select_self alone).
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_connections.sql
git commit -m "feat(db): add connections, membership, invitations, and accept RPC"
```

---

## Task 5: Migration 0003 — Categories

**Files:**
- Create: `supabase/migrations/0003_categories.sql`

**Interfaces:**
- Consumes: `public.connections`, `public.is_connection_member` (Task 4).
- Produces: table `public.categories(id, type, name, icon, connection_id, created_at)` seeded with the 5 default categories from requirements.md §3.3 — Task 7's `transactions.category_id` foreign key references these rows.

- [ ] **Step 1: Write `supabase/migrations/0003_categories.sql`**

```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('expense', 'income')),
  name text not null,
  icon text,
  connection_id uuid references public.connections(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_select_visible" on public.categories
  for select using (
    connection_id is null or public.is_connection_member(connection_id)
  );

create policy "categories_insert_as_member" on public.categories
  for insert with check (
    connection_id is not null and public.is_connection_member(connection_id)
  );

insert into public.categories (type, name, connection_id) values
  ('expense', '식비', null),
  ('expense', '육아', null),
  ('expense', '문화', null),
  ('expense', '경조사', null),
  ('income', '월급', null);
```

- [ ] **Step 2: Apply migrations locally**

Run: `supabase db reset`
Expected: exits 0, applies `0003_categories.sql`.

- [ ] **Step 3: Verify default categories are globally readable**

```sql
select count(*) from public.categories where connection_id is null;
-- Expected: 5

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
select name, type from public.categories order by name;
-- Expected: all 5 default rows visible even with no connection membership check needed (connection_id is null).
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_categories.sql
git commit -m "feat(db): add categories table with seeded defaults"
```

---

## Task 6: Migration 0004 — Events

**Files:**
- Create: `supabase/migrations/0004_events.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.connections`, `public.is_connection_member` (Tasks 3–4).
- Produces: table `public.events(id, connection_id, owner_id, visibility, title, location, companions, all_day, start_at, end_at, created_by, created_at, updated_at)` — Phase 3's calendar/thread CRUD reads/writes this table directly via Server Actions.

- [ ] **Step 1: Write `supabase/migrations/0004_events.sql`**

```sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.connections(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  visibility text not null default 'personal' check (visibility in ('personal', 'shared')),
  title text not null,
  location text,
  companions text,
  all_day boolean not null default false,
  start_at timestamptz not null,
  end_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_shared_requires_connection check (
    visibility = 'personal' or connection_id is not null
  )
);

create index events_connection_id_idx on public.events (connection_id);
create index events_owner_id_idx on public.events (owner_id);
create index events_start_at_idx on public.events (start_at);

alter table public.events enable row level security;

create policy "events_select_owner_or_member" on public.events
  for select using (
    owner_id = auth.uid()
    or (connection_id is not null and public.is_connection_member(connection_id))
  );

create policy "events_insert_as_owner" on public.events
  for insert with check (
    owner_id = auth.uid()
    and (connection_id is null or public.is_connection_member(connection_id))
  );

create policy "events_update_as_owner" on public.events
  for update using (owner_id = auth.uid());

create policy "events_delete_as_owner" on public.events
  for delete using (owner_id = auth.uid());
```

- [ ] **Step 2: Apply migrations locally**

Run: `supabase db reset`
Expected: exits 0, applies `0004_events.sql`.

- [ ] **Step 3: Verify shared-without-connection is rejected (Review Focus)**

```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

insert into public.events (owner_id, visibility, title, start_at)
values ('11111111-1111-1111-1111-111111111111', 'shared', 'orphan shared event', now());
-- Expected: ERROR violates check constraint "events_shared_requires_connection"
```

- [ ] **Step 4: Verify partner sees personal event, unrelated user does not**

```sql
insert into public.events (connection_id, owner_id, visibility, title, start_at, created_by)
values (
  (select connection_id from public.connection_members where user_id = '11111111-1111-1111-1111-111111111111'),
  '11111111-1111-1111-1111-111111111111', 'personal', 'dentist', now(), '11111111-1111-1111-1111-111111111111'
);

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
select title from public.events where title = 'dentist';
-- Expected: 1 row (connection member can see the owner's personal event).
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_events.sql
git commit -m "feat(db): add events table with visibility-aware RLS"
```

---

## Task 7: Migration 0005 — Transactions

**Files:**
- Create: `supabase/migrations/0005_transactions.sql`

**Interfaces:**
- Consumes: `public.connections`, `public.profiles`, `public.categories`, `public.is_connection_member` (Tasks 3–5).
- Produces: table `public.transactions(id, connection_id, owner_id, category_id, type, amount, memo, occurred_at, created_by, created_at, updated_at)` — Phase 3's account-book CRUD reads/writes this table directly via Server Actions.

- [ ] **Step 1: Write `supabase/migrations/0005_transactions.sql`**

```sql
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  type text not null check (type in ('expense', 'income')),
  amount numeric(12, 2) not null check (amount > 0),
  memo text,
  occurred_at date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_connection_id_idx on public.transactions (connection_id);
create index transactions_occurred_at_idx on public.transactions (occurred_at);

alter table public.transactions enable row level security;

create policy "transactions_select_member" on public.transactions
  for select using (public.is_connection_member(connection_id));

create policy "transactions_insert_as_member" on public.transactions
  for insert with check (
    public.is_connection_member(connection_id) and owner_id = auth.uid()
  );

create policy "transactions_update_as_owner" on public.transactions
  for update using (owner_id = auth.uid());

create policy "transactions_delete_as_owner" on public.transactions
  for delete using (owner_id = auth.uid());
```

- [ ] **Step 2: Apply migrations locally**

Run: `supabase db reset`
Expected: exits 0, applies `0005_transactions.sql`.

- [ ] **Step 3: Verify non-positive amount is rejected (Review Focus)**

```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

insert into public.transactions (connection_id, owner_id, category_id, type, amount)
values (
  (select connection_id from public.connection_members where user_id = '11111111-1111-1111-1111-111111111111'),
  '11111111-1111-1111-1111-111111111111',
  (select id from public.categories where name = '식비'),
  'expense', 0
);
-- Expected: ERROR violates check constraint "transactions_amount_check"
```

- [ ] **Step 4: Verify partner can read a logged transaction**

```sql
insert into public.transactions (connection_id, owner_id, category_id, type, amount, memo)
values (
  (select connection_id from public.connection_members where user_id = '11111111-1111-1111-1111-111111111111'),
  '11111111-1111-1111-1111-111111111111',
  (select id from public.categories where name = '식비'),
  'expense', 12000, 'lunch'
);

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
select memo, amount from public.transactions where memo = 'lunch';
-- Expected: 1 row.
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_transactions.sql
git commit -m "feat(db): add transactions table with amount validation and member RLS"
```

---

## Task 8: Generate TypeScript Types from Schema

**Files:**
- Create: `src/types/database.types.ts`
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/supabase/server.ts`

**Interfaces:**
- Consumes: the live local schema from Tasks 3–7.
- Produces: `Database` type export from `src/types/database.types.ts`, used as the generic parameter on both `createClient()` functions — later phases' Server Actions get compile-time-checked table/column names.

- [ ] **Step 1: Generate types**

Run: `supabase gen types typescript --local > src/types/database.types.ts`
Expected: file is written and non-empty, exporting `export type Database = { public: { Tables: { profiles: ...; connections: ...; connection_members: ...; connection_invitations: ...; categories: ...; events: ...; transactions: ... } ... } }`.

- [ ] **Step 2: Wire the type into `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Wire the type into `src/lib/supabase/server.ts`**

Apply the same `<Database>` generic to the `createServerClient` call in `src/lib/supabase/server.ts`, keeping the rest of the function body unchanged.

- [ ] **Step 4: Verify build still passes**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.types.ts src/lib/supabase/client.ts src/lib/supabase/server.ts
git commit -m "chore: generate and wire typed Supabase client"
```

---

## Task 9: End-to-End Phase 1 Acceptance Script

**Files:**
- Create: `scripts/verify-phase1.mjs`

**Interfaces:**
- Consumes: `@supabase/supabase-js` admin client (service role key), the running local Supabase stack from Tasks 1–8.
- Produces: a standalone Node script (`node scripts/verify-phase1.mjs`) that is the single holistic Phase 1 acceptance gate, run once after Task 7's table-by-table checks pass.

- [ ] **Step 1: Write `scripts/verify-phase1.mjs`**

```javascript
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert(serviceKey && anonKey, "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");

const admin = createClient(url, serviceKey);

async function createTestUser(phone) {
  const { data, error } = await admin.auth.admin.createUser({ phone, phone_confirm: true });
  assert.equal(error, null, `createUser(${phone}) failed: ${error?.message}`);
  return data.user.id;
}

async function signInAs(phone) {
  const client = createClient(url, anonKey);
  const { error } = await client.auth.signInWithOtp({ phone });
  assert.equal(error, null, `signInWithOtp(${phone}) failed: ${error?.message}`);
  const { data, error: verifyError } = await client.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  assert.equal(verifyError, null, `verifyOtp(${phone}) failed: ${verifyError?.message}`);
  assert(data.session, "expected a session after OTP verification");
  return client;
}

const userAPhone = "+15555551001";
const userBPhone = "+15555551002";
const userCPhone = "+15555551003"; // unrelated third user

const userAId = await createTestUser(userAPhone);
const userBId = await createTestUser(userBPhone);
await createTestUser(userCPhone);

const clientA = await signInAs(userAPhone);
const clientB = await signInAs(userBPhone);
const clientC = await signInAs(userCPhone);

const { data: found } = await clientA.rpc("search_profile_by_phone", { target_phone: userBPhone });
assert.equal(found.length, 1, "expected to find user B by exact phone match");
assert.equal(found[0].id, userBId);

const { data: invitation, error: inviteError } = await clientA
  .from("connection_invitations")
  .insert({ inviter_id: userAId, invitee_id: userBId })
  .select()
  .single();
assert.equal(inviteError, null, inviteError?.message);

const { data: connectionId, error: acceptError } = await clientB.rpc("accept_connection_invitation", {
  target_invitation_id: invitation.id,
});
assert.equal(acceptError, null, acceptError?.message);

const { data: category } = await clientA.from("categories").select("id").eq("name", "식비").single();

const { error: txError } = await clientA.from("transactions").insert({
  connection_id: connectionId,
  owner_id: userAId,
  category_id: category.id,
  type: "expense",
  amount: 15000,
  memo: "e2e test",
});
assert.equal(txError, null, txError?.message);

const { data: bSeesTx } = await clientB.from("transactions").select("memo").eq("memo", "e2e test");
assert.equal(bSeesTx.length, 1, "connected partner must see the transaction");

const { data: cSeesTx } = await clientC.from("transactions").select("memo").eq("memo", "e2e test");
assert.equal(cSeesTx.length, 0, "unrelated user must NOT see the transaction");

const { data: cSeesConnection } = await clientC.from("connections").select("id").eq("id", connectionId);
assert.equal(cSeesConnection.length, 0, "unrelated user must NOT see the connection row");

console.log("Phase 1 acceptance script: PASS");
```

- [ ] **Step 2: Run it against the local stack**

Run: `supabase db reset && supabase start` (if not already running), then:
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key> SUPABASE_SERVICE_ROLE_KEY=<local service role key> node scripts/verify-phase1.mjs`
(local keys are printed by `supabase status`)
Expected: prints `Phase 1 acceptance script: PASS` and exits 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-phase1.mjs
git commit -m "test: add end-to-end Phase 1 RLS acceptance script"
```

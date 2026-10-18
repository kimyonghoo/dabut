-- Per-payment-method monthly performance goals ("카드실적").
--
-- This is a personal (never partner-shared) feature: each user manages their
-- own payment methods and goals privately. A payment method's *name/icon*
-- tag on a transaction rides along with whatever visibility that
-- transaction already has (no extra policy needed there — see the
-- transactions.payment_method_id column below), but the payment_methods row
-- itself (which carries the goal) is owner-only, full stop: nothing in this
-- app's UI resolves another user's payment method name/goal, so there is no
-- reason to relax this for a connected partner.

-- ---------------------------------------------------------------------------
-- payment_methods
-- ---------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  icon text,
  monthly_goal numeric(12, 2) check (monthly_goal is null or monthly_goal >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_methods_owner_id_idx on public.payment_methods (owner_id);

alter table public.payment_methods enable row level security;

-- Owner-only, matching the personal (connection_id-null) categories style in
-- 0011_personal_ledger_and_categories.sql.
create policy "payment_methods_select_owner" on public.payment_methods
  for select using (owner_id = auth.uid());

create policy "payment_methods_insert_owner" on public.payment_methods
  for insert with check (owner_id = auth.uid());

create policy "payment_methods_update_owner" on public.payment_methods
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "payment_methods_delete_owner" on public.payment_methods
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- transactions.payment_method_id
-- ---------------------------------------------------------------------------
-- No extra RLS needed: a transaction's payment_method_id is just another
-- column on a row already governed by transactions' own select/insert/
-- update/delete policies — whoever can see the transaction sees this value.
alter table public.transactions
  add column payment_method_id uuid references public.payment_methods(id) on delete set null;

create index transactions_payment_method_id_idx
  on public.transactions (payment_method_id)
  where payment_method_id is not null;

-- ---------------------------------------------------------------------------
-- payment_method_milestone_log
-- ---------------------------------------------------------------------------
-- Records which of the 50/80/100 thresholds have already fired a Telegram
-- notification for a given payment method in a given calendar month, so a
-- notification fires once per threshold per month. The primary key doubles
-- as the insert-if-not-exists guard: two near-simultaneous transactions
-- racing to cross the same threshold will have one insert succeed and the
-- other fail with a unique violation, which the caller treats as
-- "already notified, skip" — no double-fire.
create table public.payment_method_milestone_log (
  payment_method_id uuid not null references public.payment_methods(id) on delete cascade,
  year_month text not null,
  threshold smallint not null check (threshold in (50, 80, 100)),
  notified_at timestamptz not null default now(),
  primary key (payment_method_id, year_month, threshold)
);

alter table public.payment_method_milestone_log enable row level security;

create policy "payment_method_milestone_log_select_owner" on public.payment_method_milestone_log
  for select using (
    exists (
      select 1 from public.payment_methods pm
      where pm.id = payment_method_id and pm.owner_id = auth.uid()
    )
  );

create policy "payment_method_milestone_log_insert_owner" on public.payment_method_milestone_log
  for insert with check (
    exists (
      select 1 from public.payment_methods pm
      where pm.id = payment_method_id and pm.owner_id = auth.uid()
    )
  );

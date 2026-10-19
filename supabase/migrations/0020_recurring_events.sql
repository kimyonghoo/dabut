-- Recurring events ("반복일정"), Samsung/Google-Calendar-style:
-- a standard recurrence-rule-plus-exceptions model. Only the "parent"/
-- original event row carries a recurrence rule; concrete occurrences are
-- computed at read time (see src/lib/events/recurrence.ts) and are never
-- stored as rows, except for per-occurrence exceptions below.

alter table public.events
  add column recurrence_freq text check (recurrence_freq in ('daily', 'weekly', 'monthly', 'yearly')),
  add column recurrence_interval int not null default 1 check (recurrence_interval > 0),
  add column recurrence_end_type text check (recurrence_end_type in ('never', 'until', 'count')),
  add column recurrence_until date,
  add column recurrence_count int check (recurrence_count > 0);

-- Keep the recurrence_* columns internally consistent: either the event
-- isn't recurring at all (everything null, interval still defaults to 1),
-- or it has a freq and exactly the end-condition field its end_type needs.
alter table public.events
  add constraint events_recurrence_consistency check (
    (
      recurrence_freq is null
      and recurrence_end_type is null
      and recurrence_until is null
      and recurrence_count is null
    )
    or (
      recurrence_freq is not null
      and (
        (recurrence_end_type = 'never' and recurrence_until is null and recurrence_count is null)
        or (recurrence_end_type = 'until' and recurrence_until is not null and recurrence_count is null)
        or (recurrence_end_type = 'count' and recurrence_count is not null and recurrence_until is null)
      )
    )
  );

-- Per-occurrence overrides for a recurring parent event. Exactly one of two
-- things per row: the occurrence is cancelled outright (skip it when
-- expanding), or it's been detached into its own standalone `events` row
-- with edited details (the expansion skips generating the computed instance
-- for that date and the detached row is displayed in its place instead).
create table public.event_exceptions (
  id uuid primary key default gen_random_uuid(),
  parent_event_id uuid not null references public.events(id) on delete cascade,
  -- The occurrence's original, unmodified calendar date, in the parent
  -- event's own timezone — not a UTC instant, since a recurring event
  -- repeats at the same wall-clock date/time each cycle.
  occurrence_date date not null,
  cancelled boolean not null default false,
  modified_event_id uuid references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_exceptions_exactly_one_outcome check (
    (cancelled and modified_event_id is null) or (not cancelled and modified_event_id is not null)
  ),
  constraint event_exceptions_unique_occurrence unique (parent_event_id, occurrence_date)
);

create index event_exceptions_parent_event_id_idx on public.event_exceptions (parent_event_id);
create index event_exceptions_modified_event_id_idx on public.event_exceptions (modified_event_id);

alter table public.event_exceptions enable row level security;

create policy "event_exceptions_select_via_parent" on public.event_exceptions
  for select using (
    exists (
      select 1 from public.events e
      where e.id = parent_event_id
        and (e.owner_id = auth.uid() or (e.connection_id is not null and public.is_connection_member(e.connection_id)))
    )
  );

create policy "event_exceptions_insert_via_parent_owner" on public.event_exceptions
  for insert with check (
    exists (select 1 from public.events e where e.id = parent_event_id and e.owner_id = auth.uid())
  );

create policy "event_exceptions_update_via_parent_owner" on public.event_exceptions
  for update using (
    exists (select 1 from public.events e where e.id = parent_event_id and e.owner_id = auth.uid())
  );

create policy "event_exceptions_delete_via_parent_owner" on public.event_exceptions
  for delete using (
    exists (select 1 from public.events e where e.id = parent_event_id and e.owner_id = auth.uid())
  );

-- If a detached occurrence's standalone event row is deleted directly
-- (independent of its parent series), convert its exception into a plain
-- "cancelled" exception instead of letting the FK wipe the exception row
-- outright — otherwise the parent's expansion would regenerate the original
-- (pre-edit) computed occurrence for that date, resurrecting an event the
-- user just deleted. security definer: this is narrow, internal bookkeeping
-- that must run regardless of which RLS policy let the delete through.
create or replace function public.handle_detached_event_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_exceptions
  set cancelled = true, modified_event_id = null
  where modified_event_id = old.id;
  return old;
end;
$$;

create trigger events_detach_cleanup
  before delete on public.events
  for each row execute function public.handle_detached_event_delete();

-- A single-occurrence cancel/detach ("이 일정만") only writes to
-- event_exceptions, not events — the realtime calendar refresh
-- (src/components/realtime/realtime-refresh.tsx) needs this table too so a
-- connected partner's calendar live-updates on that action.
alter publication supabase_realtime add table public.event_exceptions;

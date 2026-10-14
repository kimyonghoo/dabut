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

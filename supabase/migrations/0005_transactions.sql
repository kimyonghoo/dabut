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

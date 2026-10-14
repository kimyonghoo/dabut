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

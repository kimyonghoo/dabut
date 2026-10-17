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

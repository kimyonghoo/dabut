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

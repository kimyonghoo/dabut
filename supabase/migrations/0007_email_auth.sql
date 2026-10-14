-- Switch the user identifier from phone to email, per updated requirements
-- (requirements.md §3.1: "이메일로 인증해서 가입"). This supersedes Phase 1's
-- original phone-based design (migrations 0001 and part of 0006).

-- Dev-only fixture rows from earlier phone-based testing; nothing in the
-- committed app depends on these ids, so a clean slate is simplest.
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

alter table public.profiles rename column phone to email;

-- Postgres leaves the old constraint/index names in place across a rename;
-- give them accurate names so future reads of \d don't say "phone".
alter table public.profiles rename constraint profiles_phone_key to profiles_email_key;

-- Signup can arrive from any auth method in the future; store email
-- normalized (lowercased) so case never causes a false non-match.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is not null then
    insert into public.profiles (id, email)
    values (new.id, lower(new.email));
  end if;
  return new;
end;
$$;

drop function public.search_profile_by_phone(text);

create function public.search_profile_by_email(target_email text)
returns table (id uuid, display_name text)
language sql
security definer set search_path = public
stable
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.email = lower(trim(target_email))
    and p.id <> auth.uid();
$$;

-- Apply the Phase 1 review lesson directly: Supabase's default privileges
-- grant EXECUTE straight to anon/authenticated/service_role, not via PUBLIC,
-- so both must be revoked explicitly to keep this PII-bearing RPC private.
revoke all on function public.search_profile_by_email(text) from public, anon;
grant execute on function public.search_profile_by_email(text) to authenticated;

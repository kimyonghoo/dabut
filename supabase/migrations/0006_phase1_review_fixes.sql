-- Fixes from the Phase 1 whole-branch review (see
-- docs/superpowers/plans/2026-10-14-dabut-phase1-setup.md and the plan's
-- execution ledger for the review findings this addresses).

-- Important #1: Supabase's default privileges grant EXECUTE on every new
-- public-schema function directly to anon/authenticated/service_role (not
-- via PUBLIC, so `revoke ... from public` alone does not touch it).
-- search_profile_by_phone is SECURITY DEFINER and PostgREST-exposed, so
-- without this revoke an unauthenticated caller holding the public anon key
-- could probe arbitrary phone numbers and learn who is registered.
revoke all on function public.search_profile_by_phone(text) from public, anon;
grant execute on function public.search_profile_by_phone(text) to authenticated;

revoke all on function public.accept_connection_invitation(uuid) from public, anon;
grant execute on function public.accept_connection_invitation(uuid) to authenticated;

-- Important #5: normalize the search input inside the function so callers
-- don't have to independently reproduce Supabase Auth's "strip the leading +"
-- storage format to get a match.
create or replace function public.search_profile_by_phone(target_phone text)
returns table (id uuid, display_name text)
language sql
security definer set search_path = public
stable
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.phone = regexp_replace(target_phone, '\D', '', 'g')
    and p.id <> auth.uid();
$$;

-- Important #2: an UPDATE policy with only USING reuses that same expression
-- as its WITH CHECK, so these policies allowed an owner to repoint
-- connection_id to a connection they are not a member of. Add the same
-- membership guard the insert policies already have.
drop policy "events_update_as_owner" on public.events;
create policy "events_update_as_owner" on public.events
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (connection_id is null or public.is_connection_member(connection_id))
  );

drop policy "transactions_update_as_owner" on public.transactions;
create policy "transactions_update_as_owner" on public.transactions
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid() and public.is_connection_member(connection_id)
  );

-- Important #3: the unique index only blocked a second *pending* invite in
-- the same direction, so two already-connected users could still invite each
-- other again and accept_connection_invitation would create a second,
-- disconnected connection. Block the insert at the policy layer...
drop policy "connection_invitations_insert_as_inviter" on public.connection_invitations;
create policy "connection_invitations_insert_as_inviter" on public.connection_invitations
  for insert with check (
    inviter_id = auth.uid()
    and not exists (
      select 1
      from public.connection_members cm1
      join public.connection_members cm2 on cm1.connection_id = cm2.connection_id
      where cm1.user_id = inviter_id and cm2.user_id = invitee_id
    )
  );

-- ...and as a second line of defense against any invitation that slipped in
-- before this policy existed, make accept_connection_invitation itself
-- refuse to create a duplicate connection for an already-connected pair.
create or replace function public.accept_connection_invitation(target_invitation_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_invitation public.connection_invitations;
  v_connection_id uuid;
  v_existing_connection_id uuid;
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

  select cm1.connection_id into v_existing_connection_id
  from public.connection_members cm1
  join public.connection_members cm2 on cm1.connection_id = cm2.connection_id
  where cm1.user_id = v_invitation.inviter_id and cm2.user_id = v_invitation.invitee_id
  limit 1;

  if v_existing_connection_id is not null then
    raise exception 'these users are already connected';
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

-- Important #4: a phone-less (e.g. email-only) signup previously crashed the
-- whole signup with a not-null violation, because handle_new_user always
-- tried to create a profile row. This app's identifier is phone (per spec);
-- a phone-less account simply gets no profile row instead of failing signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.phone is not null then
    insert into public.profiles (id, phone)
    values (new.id, new.phone);
  end if;
  return new;
end;
$$;

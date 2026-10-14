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

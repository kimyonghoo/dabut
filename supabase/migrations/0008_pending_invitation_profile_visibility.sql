-- Phase 3 finding: the Settings page needs to show a pending invitation's
-- other party's email (inviter's email to the invitee, and symmetrically the
-- invitee's email to the inviter for a "sent invitations" list), but Phase 1's
-- profiles RLS only allows self-reads or already-connected reads — there was
-- no UI yet that needed to resolve a profile during the pending window.
create policy "profiles_select_pending_connection" on public.profiles
  for select using (
    exists (
      select 1 from public.connection_invitations
      where status = 'pending'
        and (
          (inviter_id = profiles.id and invitee_id = auth.uid())
          or (invitee_id = profiles.id and inviter_id = auth.uid())
        )
    )
  );

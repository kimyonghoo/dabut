-- Fixes the reported bug: sending a connection invite failed with
-- "duplicate key value violates unique constraint connection_invitations_pending_pair_idx".
--
-- Root cause (confirmed by inspecting the live table): the unique index
-- itself is fine — it's already partial on status = 'pending', so an
-- accepted/declined invitation never blocks a later one. The real gap is
-- that a pending invitation, once sent, could never be withdrawn or
-- rejected: there was no decline-by-invitee or cancel-by-inviter path, only
-- accept_connection_invitation(). So the first resend attempt toward the
-- same still-pending invitee (a double-click with no disabled state on the
-- invite button, or simply trying again later) hit the unique index and the
-- raw Postgres error was surfaced straight to the user.
--
-- This migration gives both parties a way to retire a pending row:
--   - the invitee can decline it (status -> 'declined'), already representable
--     by the existing check constraint, but the update policy had no
--     WITH CHECK, so (per the same class of bug fixed for events/transactions
--     in 0006) it silently allowed the invitee to set status to anything,
--     including flipping it to 'accepted' without running
--     accept_connection_invitation() and its connection-creation side effects.
--   - the inviter can cancel it (status -> 'cancelled', a new status), which
--     needs its own update policy since inviters previously had no update
--     access at all.
-- Either frees the partial unique index's slot for a future invite between
-- the same pair. src/lib/actions/connections.ts also now pre-checks for an
-- existing pending invitation (either direction) and maps Postgres's
-- unique-violation (23505) to a localized message as a race-condition
-- backstop, instead of ever showing the raw DB error again.

alter table public.connection_invitations
  drop constraint connection_invitations_status_check;

alter table public.connection_invitations
  add constraint connection_invitations_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled'));

-- Tighten: the invitee may only move a pending invitation to 'declined'
-- directly. (Acceptance stays exclusively via accept_connection_invitation(),
-- a SECURITY DEFINER function owned by the table owner, which bypasses RLS
-- and performs the connection-creation side effects atomically.)
drop policy "connection_invitations_update_as_invitee" on public.connection_invitations;
create policy "connection_invitations_update_as_invitee" on public.connection_invitations
  for update using (invitee_id = auth.uid() and status = 'pending')
  with check (invitee_id = auth.uid() and status = 'declined');

-- New: the inviter may cancel their own still-pending invitation.
create policy "connection_invitations_update_as_inviter" on public.connection_invitations
  for update using (inviter_id = auth.uid() and status = 'pending')
  with check (inviter_id = auth.uid() and status = 'cancelled');

-- Shared "이번 달 목표 지출액" (monthly spending goal) — unlike payment_methods'
-- per-card goals (0018, owner-only), this one value is scoped to the couple
-- and either member can set/change it, so progress shown in the ledger is
-- against the same number for both people.
--
-- 0002_connections.sql deliberately left connections with no insert/update/
-- delete policy at all ("the only way to create either is the
-- accept_connection_invitation() RPC"). That's still true for creating a
-- connection; this adds the first ever *mutable* column on an existing
-- connection row, so an update policy is now needed too — scoped with the
-- same is_connection_member() helper already used for connections' select
-- policy, so either member (and only a member) can write it.
alter table public.connections
  add column monthly_spending_goal numeric(12, 2) check (monthly_spending_goal is null or monthly_spending_goal >= 0);

create policy "connections_update_member" on public.connections
  for update using (public.is_connection_member(id))
  with check (public.is_connection_member(id));

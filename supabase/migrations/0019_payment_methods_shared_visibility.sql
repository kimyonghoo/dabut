-- Share payment-method *visibility* with a connected partner, so a joint
-- card/cash method registered by one person can be tagged by the other when
-- logging their own transactions (e.g. a shared bank card). Monthly goals
-- and milestone tracking stay strictly private to whoever registered the
-- payment method — unchanged from 0018_payment_method_goals.sql:
--
--   * payment_method_milestone_log's policies are untouched (still
--     owner-only), so goal-crossing Telegram notifications and history
--     remain fully private.
--   * INSERT/UPDATE/DELETE on payment_methods stay owner-only (unchanged
--     below) — a partner can see a payment method but never edit or delete
--     it.
--   * The app layer is responsible for never actually fetching/displaying
--     `monthly_goal` on behalf of anyone but the owner, even though RLS now
--     lets a partner SELECT the full row. See src/lib/actions/payment-
--     methods.ts and the page-level queries in src/app/.../ledger and
--     src/app/.../settings for the owner_id filters that provide this.
--
-- The "are we connected" check mirrors the exact join pattern already used
-- by `profiles_select_connected` in 0002_connections.sql (categories/
-- transactions instead reuse `is_connection_member(connection_id)`, but
-- payment_methods has no connection_id column to join through — it's scoped
-- by owner_id only — so the profiles-style two-sided connection_members
-- join is the applicable precedent here).
drop policy "payment_methods_select_owner" on public.payment_methods;

create policy "payment_methods_select_shared" on public.payment_methods
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.connection_members mine
      join public.connection_members theirs on theirs.connection_id = mine.connection_id
      where mine.user_id = auth.uid() and theirs.user_id = public.payment_methods.owner_id
    )
  );

-- payment_methods_insert_owner / _update_owner / _delete_owner (from 0018)
-- are left exactly as they are: no changes below this line.

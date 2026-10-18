-- Personal (solo) ledger + user-created categories.
--
-- 1) A user without a connection can still record transactions: they are
--    stored with connection_id = null and are visible only to their owner.
-- 2) Users can add their own categories, either personal (owner_id set,
--    connection_id null) or shared with their connection (connection_id set).

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
alter table public.transactions alter column connection_id drop not null;

create index if not exists transactions_owner_id_idx on public.transactions (owner_id);

drop policy "transactions_select_member" on public.transactions;
create policy "transactions_select_member" on public.transactions
  for select using (
    owner_id = auth.uid()
    or (connection_id is not null and public.is_connection_member(connection_id))
  );

drop policy "transactions_insert_as_member" on public.transactions;
create policy "transactions_insert_as_member" on public.transactions
  for insert with check (
    owner_id = auth.uid()
    and (connection_id is null or public.is_connection_member(connection_id))
  );

-- Same semantics as 0006 (owner-only, cannot repoint to a foreign
-- connection), now also allowing a personal (null) connection.
drop policy "transactions_update_as_owner" on public.transactions;
create policy "transactions_update_as_owner" on public.transactions
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (connection_id is null or public.is_connection_member(connection_id))
  );

drop policy "transactions_delete_as_owner" on public.transactions;
create policy "transactions_delete_as_owner" on public.transactions
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
alter table public.categories
  add column owner_id uuid references public.profiles(id) on delete cascade;

create index if not exists categories_owner_id_idx on public.categories (owner_id);
create index if not exists categories_connection_id_idx on public.categories (connection_id);

-- Visible: global defaults (no owner, no connection), the user's own
-- categories, and categories scoped to a connection the user belongs to.
drop policy "categories_select_visible" on public.categories;
create policy "categories_select_visible" on public.categories
  for select using (
    (connection_id is null and owner_id is null)
    or owner_id = auth.uid()
    or (connection_id is not null and public.is_connection_member(connection_id))
  );

drop policy "categories_insert_as_member" on public.categories;
create policy "categories_insert_as_member" on public.categories
  for insert with check (
    owner_id = auth.uid()
    and (connection_id is null or public.is_connection_member(connection_id))
  );

create policy "categories_delete_as_owner" on public.categories
  for delete using (owner_id = auth.uid());

-- Guard against duplicate names within the same scope (personal or
-- connection). Global defaults are excluded (owner_id is null).
create unique index if not exists categories_unique_name_per_scope
  on public.categories (
    coalesce(connection_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(case when connection_id is null then owner_id end, '00000000-0000-0000-0000-000000000000'::uuid),
    type,
    name
  )
  where owner_id is not null;

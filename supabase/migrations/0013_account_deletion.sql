-- Account deletion support.
--
-- Deleting auth.users cascades to profiles and from there to the user's own
-- events, transactions, categories, connection memberships, invitations and
-- telegram link codes. What the cascade alone gets wrong:
--
--   * transactions.category_id is ON DELETE NO ACTION, so a partner's
--     transaction that uses a category the deleted user created (or a
--     connection-scoped category) would block the delete.
--   * The connection itself would survive with the partner as its only
--     member, so the partner would still look "linked" (and new items would
--     keep defaulting to the dead connection).
--   * Deleting the connection instead would cascade-delete the partner's own
--     events/transactions (connection_id is ON DELETE CASCADE).
--
-- prepare_account_deletion() runs before the auth user is deleted and:
--   1. deletes the user's own events and transactions,
--   2. turns the partner's items in each shared connection into personal
--      items (connection_id = null, shared events become personal),
--   3. hands categories still used by the partner's transactions over to the
--      partner as personal categories (reusing an existing same-name one),
--   4. removes the now-empty connection so the partner is cleanly unlinked.
-- The caller then deletes the auth user (service role), which cascades the rest.

create or replace function public.prepare_account_deletion(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_connection_id uuid;
  v_cat record;
  v_dest uuid;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  -- 1. The user's own items go away.
  delete from public.events where owner_id = target_user_id;
  delete from public.transactions where owner_id = target_user_id;

  -- Defensive: rows owned by someone else but created_by the user (FK is NO ACTION).
  update public.events set created_by = owner_id where created_by = target_user_id;
  update public.transactions set created_by = owner_id where created_by = target_user_id;

  -- 2. Partner items in each of the user's connections become personal.
  for v_connection_id in
    select connection_id from public.connection_members where user_id = target_user_id
  loop
    update public.events
      set connection_id = null, visibility = 'personal'
      where connection_id = v_connection_id;

    update public.transactions
      set connection_id = null
      where connection_id = v_connection_id;
  end loop;

  -- 3. Categories that will disappear (owned by the user, or scoped to one of
  --    the user's connections) but are still used by someone else's
  --    transactions: give each such user a personal equivalent.
  for v_cat in
    select distinct c.id, c.type, c.name, c.icon, t.owner_id as user_id
    from public.categories c
    join public.transactions t on t.category_id = c.id
    where t.owner_id <> target_user_id
      and (
        c.owner_id = target_user_id
        or c.connection_id in (
          select connection_id from public.connection_members where user_id = target_user_id
        )
      )
  loop
    select id into v_dest
    from public.categories
    where owner_id = v_cat.user_id
      and connection_id is null
      and type = v_cat.type
      and name = v_cat.name
    limit 1;

    if v_dest is null then
      insert into public.categories (type, name, icon, owner_id, connection_id)
      values (v_cat.type, v_cat.name, v_cat.icon, v_cat.user_id, null)
      returning id into v_dest;
    end if;

    update public.transactions
      set category_id = v_dest
      where category_id = v_cat.id and owner_id = v_cat.user_id;

    v_dest := null;
  end loop;

  -- 4. Drop the user's connections (categories scoped to them cascade; no
  --    events/transactions reference them any more after step 2).
  delete from public.connections
  where id in (
    select connection_id from public.connection_members where user_id = target_user_id
  );
end;
$$;

-- Server-only: callable by the service role, never by app users directly.
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

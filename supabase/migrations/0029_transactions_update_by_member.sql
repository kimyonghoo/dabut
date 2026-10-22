-- 공유 가계부(connection)의 거래는 상대방도 수정할 수 있다. 개인 가계부(connection_id null)는 여전히 본인만.
-- 삭제는 기존대로 작성자만. owner_id는 바꿀 수 없다(with check).
drop policy if exists "transactions_update_as_owner" on public.transactions;
create policy "transactions_update_as_owner_or_member" on public.transactions
  for update using (
    owner_id = auth.uid()
    or (connection_id is not null and public.is_connection_member(connection_id))
  )
  with check (
    (owner_id = auth.uid() and (connection_id is null or public.is_connection_member(connection_id)))
    or (connection_id is not null and public.is_connection_member(connection_id))
  );

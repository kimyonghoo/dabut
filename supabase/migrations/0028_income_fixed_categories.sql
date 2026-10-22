-- 수입 카테고리는 월급 / 용돈 / 페이백 3개로 고정 (전역 기본값). 기존 수입 내역은 그대로 둔다.
insert into public.categories (type, name, connection_id)
select 'income', v.name, null
from (values ('용돈'), ('페이백')) as v(name)
where not exists (
  select 1 from public.categories c
  where c.type = 'income' and c.name = v.name and c.connection_id is null and c.owner_id is null
);

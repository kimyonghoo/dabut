-- 식비 -> 외식. 이미 같은 범위에 외식이 있으면 거래를 옮기고 식비 행을 삭제한다.
update public.transactions t
set category_id = keep.id
from public.categories old, public.categories keep
where t.category_id = old.id
  and old.name = '식비'
  and keep.name = '외식'
  and keep.id <> old.id
  and keep.type = old.type
  and keep.connection_id is not distinct from old.connection_id
  and keep.owner_id is not distinct from old.owner_id;

delete from public.categories old
using public.categories keep
where old.name = '식비'
  and keep.name = '외식'
  and keep.id <> old.id
  and keep.type = old.type
  and keep.connection_id is not distinct from old.connection_id
  and keep.owner_id is not distinct from old.owner_id;

update public.categories set name = '외식' where name = '식비';

-- 통신비: the one real user already has their own 통신비 (icon: phone); the
-- global default (icon: smartphone) added in 0023 was a redundant duplicate.
delete from public.categories
where owner_id is null
  and connection_id is null
  and type = 'expense'
  and name in ('통신비');

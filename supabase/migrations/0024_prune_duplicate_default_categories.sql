-- 옷 and 주유 already exist as the one actual user's own custom categories
-- with matching icons, so the global defaults added in 0023 were exact
-- duplicates; 배달음식 is dropped outright (feedback: too much). Personal
-- category cleanup (their own duplicate 생필품/교통/편의점/구독) happened
-- directly against prod data, not via migration — that's per-user data,
-- not a schema/default-seed concern.
delete from public.categories
where owner_id is null
  and connection_id is null
  and type = 'expense'
  and name in ('배달음식', '옷', '주유');

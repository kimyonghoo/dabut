-- Expands the default expense category set from the original 4 (식비/육아/
-- 문화/경조사) to a fuller everyday-spending list. Icon stays null, same as
-- the originals — resolved by name via NAME_ICON in category-icon.tsx.
insert into public.categories (type, name, connection_id) values
  ('expense', '쇼핑', null),
  ('expense', '교통', null),
  ('expense', '생필품', null),
  ('expense', '옷', null),
  ('expense', '병원', null),
  ('expense', '약국', null),
  ('expense', '공과금', null),
  ('expense', '편의점', null),
  ('expense', '카페', null),
  ('expense', '구독', null),
  ('expense', '주유', null),
  ('expense', '통신비', null),
  ('expense', '배달음식', null),
  ('expense', '주차비', null);

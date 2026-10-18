-- profiles.display_name becomes a required-at-signup, unique (case-
-- insensitive) nickname going forward. Every existing row currently has
-- display_name = '' (it was never actually set by anything), so a plain
-- unique constraint would fail immediately against existing data. Make the
-- index partial — only non-empty values participate — so any number of
-- accounts can keep an empty display_name, and only two equal non-empty
-- nicknames collide.
create unique index profiles_display_name_unique_idx
  on public.profiles (lower(display_name))
  where display_name <> '';

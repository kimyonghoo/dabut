-- "내일 뭐해?": opt-in Telegram push, sent once a day at the user's chosen
-- local hour, summarizing tomorrow's events. Off by default; the hour is
-- only meaningful once enabled (the settings UI only shows/sets it then).
alter table public.profiles
  add column daily_digest_enabled boolean not null default false,
  add column daily_digest_hour smallint check (daily_digest_hour between 0 and 23);

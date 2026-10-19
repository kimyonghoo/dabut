-- The daily digest has no per-user hour picker after all (just on/off,
-- always sent at a fixed 18:00 — see the cron route's DIGEST_HOUR), so the
-- per-profile hour never ends up holding anything meaningful.
alter table public.profiles
  drop column daily_digest_hour;

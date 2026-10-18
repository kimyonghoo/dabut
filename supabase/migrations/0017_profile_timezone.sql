-- Per-user timezone, used to interpret the timezone-less wall-clock values a
-- <datetime-local>-shaped event form submits, and to format stored UTC
-- instants back for display. Defaults to Asia/Seoul since this app's users
-- are primarily Korean.
alter table public.profiles
  add column timezone text not null default 'Asia/Seoul';

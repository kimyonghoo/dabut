-- Telegram-OTP signup verification, replacing Supabase's emailed
-- confirmation link (unreliable here: no custom SMTP, only the default
-- rate-limited mailer). New flow:
--   1. A server action creates the auth user as unconfirmed (service role,
--      admin.createUser with email_confirm: false) and inserts a row here
--      keyed by a fresh high-entropy token, then hands the user a Telegram
--      deep link (?start=signup_<token>).
--   2. The Telegram webhook looks up the token, generates a 6-digit OTP,
--      stores its hash + the chat id + a short OTP expiry, and messages the
--      OTP to that chat.
--   3. The signup page collects the OTP; a server action compares its hash,
--      then confirms the auth user, sets profiles.telegram_chat_id (this
--      doubles as completing Telegram linking) and deletes this row.
--
-- Unlike telegram_link_codes, the user here is NOT logged in yet (the auth
-- user exists but is unconfirmed, pre-session), so there is no auth.uid() to
-- scope a user-owned RLS policy to. This table holds pre-auth secrets (OTP
-- hashes) and must only ever be reachable by the service role, which
-- bypasses RLS entirely — hence RLS enabled with zero policies (default
-- deny) plus an explicit revoke from anon/authenticated.
create table public.signup_verifications (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  otp_hash text,                      -- null until the Telegram bot generates one
  telegram_chat_id text,              -- set alongside otp_hash; copied to profiles on success
  attempts int not null default 0,
  last_sent_at timestamptz,           -- throttles OTP resend on repeated /start taps
  link_expires_at timestamptz not null,   -- deep-link validity (~30 min)
  otp_expires_at timestamptz,             -- set when otp_hash is set (~10 min)
  created_at timestamptz not null default now()
);

create index signup_verifications_user_id_idx on public.signup_verifications (user_id);

alter table public.signup_verifications enable row level security;

-- No policies: default-deny for anon/authenticated. Only the service role
-- (which bypasses RLS) may read or write this table.
revoke all on public.signup_verifications from public, anon, authenticated;

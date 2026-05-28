-- garmin_auth: caches Garmin Connect OAuth tokens so we log in ONCE and reuse
-- the token across the daily sync cron and backfill runs. Repeated full logins
-- trip Garmin's anti-abuse ("Ticket not found or MFA"); a stored oauth1 token
-- lets the client silently refresh the short-lived oauth2 token instead.
-- Single row keyed by user_id (default 'me'). Service role bypasses RLS.

create table if not exists garmin_auth (
  user_id text primary key default 'me',
  oauth1 jsonb not null,
  oauth2 jsonb not null,
  updated_at timestamptz default now()
);

alter table garmin_auth enable row level security;

-- Deny-all: only the service role (which bypasses RLS) may read/write tokens.
drop policy if exists "deny all garmin_auth" on garmin_auth;
create policy "deny all garmin_auth" on garmin_auth
  for all using (false) with check (false);

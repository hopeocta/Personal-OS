-- Multi-Person: 3 weitere Personen als Read-only-Dashboards neben 'me'.
-- Bisher war alles implizit Single-User (user_id DEFAULT 'me'). Diese Migration
-- zieht eine echte Person-Dimension ein:
--   1) persons-Registry (inkl. Zeitbudget für die Trainingsplan-Generierung)
--   2) Garmin-Unique-Keys von 'date'/'activity_id' auf (user_id, ...) umstellen,
--      sonst kollidieren zwei Personen am selben Kalendertag bzw. teilen sich
--      fälschlich eine activity_id.
-- Bestehende 'me'-Rows bleiben gültig (user_id ist überall bereits gesetzt).
-- WICHTIG: Die onConflict-Targets in app/api/garmin/sync/route.ts MÜSSEN passend
-- mitgeändert werden (Phase 2) — sonst schlägt jeder Upsert fehl.

-- ---------------------------------------------------------------------------
-- 1) Personen-Registry
-- ---------------------------------------------------------------------------
create table if not exists persons (
  id            text primary key,            -- 'me','p1','p2','p3' — stabil, nie umbenennen
  display_name  text not null,
  active        boolean not null default true,
  -- Zeitbudget für die Trainingsplan-Generierung (Stunden/Woche + Tage + Ziel)
  weekly_hours    numeric,                   -- z.B. 6
  available_days  text[],                    -- z.B. {Mo,Mi,Fr,Sa}
  goal            text,                      -- z.B. "Halbmarathon Oktober", "Form halten", "Abnehmen"
  sport_focus     text,                      -- z.B. "Laufen", "Triathlon", "Rad"
  created_at      timestamptz not null default now()
);

insert into persons (id, display_name) values ('me', 'Ich')
  on conflict (id) do nothing;

alter table persons enable row level security;
drop policy if exists persons_deny_all on persons;
create policy persons_deny_all on persons for all using (false) with check (false);

-- ---------------------------------------------------------------------------
-- 2) Unique-Keys auf (user_id, ...) umstellen
-- ---------------------------------------------------------------------------

-- garmin_activities: war UNIQUE (activity_id)
alter table garmin_activities drop constraint if exists garmin_activities_activity_id_key;
create unique index if not exists garmin_activities_user_activity_uidx
  on garmin_activities (user_id, activity_id);

-- garmin_sleep: war UNIQUE (date)
alter table garmin_sleep drop constraint if exists garmin_sleep_date_key;
create unique index if not exists garmin_sleep_user_date_uidx
  on garmin_sleep (user_id, date);

-- garmin_body_battery: war UNIQUE (date)
alter table garmin_body_battery drop constraint if exists garmin_body_battery_date_key;
create unique index if not exists garmin_body_battery_user_date_uidx
  on garmin_body_battery (user_id, date);

-- garmin_training: war UNIQUE (date)
alter table garmin_training drop constraint if exists garmin_training_date_key;
create unique index if not exists garmin_training_user_date_uidx
  on garmin_training (user_id, date);

-- training_plan_sessions: schneller Filter pro Person + Datum (kein Unique nötig)
create index if not exists training_plan_sessions_user_date_idx
  on training_plan_sessions (user_id, date);

-- ---------------------------------------------------------------------------
-- 3) training_plan_sessions: intensity_kind für Farb-/Badge-Logik im Frontend
-- ---------------------------------------------------------------------------
-- 'interval'   = Intervall/VO2max/Threshold (rot/orange Badge)
-- 'endurance'  = Ausdauer/Dauertraining Z1–Z2 (grün Badge)
-- 'technique'  = Technik-Training (Schwimmen Drills, kein HF-Ziel) (blau Badge)
-- 'rest'       = Ruhetag / aktive Erholung (grau Badge)
alter table training_plan_sessions
  add column if not exists intensity_kind text
    check (intensity_kind in ('interval','endurance','technique','rest'));

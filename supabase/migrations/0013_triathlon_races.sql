-- Triathlon-Wettkämpfe als Benchmarks: eine Zeile pro Rennen.
-- Pro Disziplin (Schwimmen/Rad/Laufen) Zeit, Distanz, HF und Tempo + Wechselzeiten,
-- dazu ein Readiness-Snapshot vom Renn-Morgen (HRV, Ruhepuls, Body Battery, Schlaf).
-- Detail-Zeitreihen (HF/Höhe/Tempo) werden bei Bedarf per scripts/garmin-activity-hr.mjs
-- aus garmin_activity_id reproduziert — hier stehen nur die Eckwerte/Benchmarks.

create table if not exists triathlon_races (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'me',
  date date not null,
  name text,
  location text,
  garmin_activity_id bigint,            -- Multisport-Parent-ID (für Detail-Reproduktion)

  -- Gesamt
  total_duration_min numeric,
  total_distance_km numeric,
  total_elev_gain_m int,

  -- Schwimmen
  swim_distance_km numeric,
  swim_duration_min numeric,
  swim_avg_hr int,
  swim_max_hr int,
  swim_pace_per_100m text,              -- mm:ss / 100 m

  -- Wechsel
  t1_min numeric,
  t2_min numeric,

  -- Rad
  bike_distance_km numeric,
  bike_duration_min numeric,
  bike_avg_hr int,
  bike_max_hr int,
  bike_avg_speed_kmh numeric,
  bike_elev_gain_m int,

  -- Laufen
  run_distance_km numeric,
  run_duration_min numeric,
  run_avg_hr int,
  run_max_hr int,
  run_avg_pace_min_km text,             -- mm:ss / km
  run_elev_gain_m int,

  -- Readiness-Snapshot (Renn-Morgen)
  hrv_morning int,
  rhr_morning int,
  body_battery_morning int,
  sleep_score int,

  notes text,
  created_at timestamptz not null default now(),

  unique (user_id, date, name)
);

create index if not exists triathlon_races_date_idx on triathlon_races (date desc);

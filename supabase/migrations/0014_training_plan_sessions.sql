-- Geplante Trainingseinheiten (Trainingsplan) als Quelle für die "Nächste 7 Tage"-Ansicht.
-- Eine Zeile pro geplanter Einheit. Seiten lesen NUR hieraus (kein Claude beim Page-Load).
-- Runna stellt die Läufe; Rad/Schwimmen/Kraft kommen aus dem Plan. Details (HF-Zone,
-- Watt für Indoor-Rad, Pace, Easy-Flag, Satzbeschreibung) hängen pro Einheit dran.

create table if not exists training_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'me',
  date date not null,
  sport text not null,              -- swim | bike | run | strength | brick | rest
  session_type text,               -- easy | long | quality | intervals | tempo | sweetspot | threshold | vo2max | recovery | rest
  title text not null,             -- z.B. "Easy-Lauf", "Rad Sweet-Spot 2×12'"
  is_easy boolean not null default false,
  hf_zone text,                    -- z.B. "Z2", "Z4/Z5"
  hf_range text,                   -- z.B. "130–147"
  pace_speed text,                 -- Lauf-Pace oder Rad-Tempo-Ziel
  watts_indoor text,               -- z.B. "157–176 W" (nur Indoor-Rad)
  duration_min int,
  distance_km numeric,
  details text,                    -- vollständige Satzbeschreibung
  source text not null default 'plan',  -- plan | runna
  sort_order int not null default 0,    -- Reihenfolge innerhalb eines Tages
  created_at timestamptz not null default now()
);

create index if not exists training_plan_sessions_date_idx on training_plan_sessions (date);

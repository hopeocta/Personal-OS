-- Personal OS — initial schema
-- garmin_activities : auto-populated by daily Garmin cron
-- garmin_sleep      : nightly sleep data from Garmin
-- garmin_body_battery: body battery and stress from Garmin
-- strength_sessions : manual strength training log
-- daily_habits      : manual daily habit tracking
-- nutrition_logs    : manual nutrition tracking
-- knowledge_entries : research / notes, auto-categorised by Claude
-- music_projects    : FL Studio project tracker
-- sound_library     : sample/sound metadata (no audio files stored)

-- ---------------------------------------------------------------------------
-- garmin_activities
-- ---------------------------------------------------------------------------
CREATE TABLE garmin_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL DEFAULT 'me',
  activity_id   bigint UNIQUE,
  date          date NOT NULL,
  type          text,
  duration_min  int,
  distance_km   numeric,
  avg_hr        int,
  max_hr        int,
  calories      int,
  elevation_m   int,
  avg_pace      text,
  name          text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE garmin_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON garmin_activities FOR ALL USING (false);

-- ---------------------------------------------------------------------------
-- garmin_sleep
-- ---------------------------------------------------------------------------
CREATE TABLE garmin_sleep (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text NOT NULL DEFAULT 'me',
  date             date UNIQUE NOT NULL,
  sleep_score      int,
  hrv_nightly      int,
  total_sleep_min  int,
  deep_sleep_min   int,
  rem_sleep_min    int,
  light_sleep_min  int,
  awake_min        int,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE garmin_sleep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON garmin_sleep FOR ALL USING (false);

-- ---------------------------------------------------------------------------
-- garmin_body_battery
-- ---------------------------------------------------------------------------
CREATE TABLE garmin_body_battery (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text NOT NULL DEFAULT 'me',
  date           date UNIQUE NOT NULL,
  morning_score  int,
  evening_score  int,
  stress_avg     int,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE garmin_body_battery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON garmin_body_battery FOR ALL USING (false);

-- ---------------------------------------------------------------------------
-- strength_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE strength_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text NOT NULL DEFAULT 'me',
  date         date NOT NULL,
  intensity    int NOT NULL CHECK (intensity IN (1, 2, 3)),
  session_type text,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE strength_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON strength_sessions FOR ALL USING (false);

-- ---------------------------------------------------------------------------
-- daily_habits
-- ---------------------------------------------------------------------------
CREATE TABLE daily_habits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL DEFAULT 'me',
  date        date NOT NULL,
  habit_name  text NOT NULL,
  completed   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (date, habit_name)
);

ALTER TABLE daily_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON daily_habits FOR ALL USING (false);

-- ---------------------------------------------------------------------------
-- nutrition_logs
-- ---------------------------------------------------------------------------
CREATE TABLE nutrition_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL DEFAULT 'me',
  date       date UNIQUE NOT NULL,
  calories   int,
  protein_g  int,
  carbs_g    int,
  fat_g      int,
  notes      text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON nutrition_logs FOR ALL USING (false);

-- ---------------------------------------------------------------------------
-- knowledge_entries
-- ---------------------------------------------------------------------------
CREATE TABLE knowledge_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL DEFAULT 'me',
  raw_text   text NOT NULL,
  category   text,
  summary    text,
  tags       text[],
  source     text DEFAULT 'dashboard',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON knowledge_entries FOR ALL USING (false);

-- ---------------------------------------------------------------------------
-- music_projects
-- ---------------------------------------------------------------------------
CREATE TABLE music_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL DEFAULT 'me',
  title       text NOT NULL,
  bpm         int,
  musical_key text,
  scale       text,
  genre       text,
  mood        text,
  status      text DEFAULT 'idea' CHECK (status IN ('idea','wip','mixing','done','released')),
  collab      text,
  notes       text,
  date_started date DEFAULT CURRENT_DATE,
  updated_at  timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE music_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON music_projects FOR ALL USING (false);

-- ---------------------------------------------------------------------------
-- sound_library
-- ---------------------------------------------------------------------------
CREATE TABLE sound_library (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL DEFAULT 'me',
  name        text NOT NULL,
  category    text NOT NULL,
  subcategory text,
  tags        text[],
  bpm         int,
  musical_key text,
  file_path   text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE sound_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON sound_library FOR ALL USING (false);

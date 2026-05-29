-- Erweiterung für die Analyse nach dem Garmin-Leitfaden.
-- Quellen (alle pro Kalendertag, ein Request je Endpoint):
--   hrv-service/hrv/{date}                          → HRV-Baseline & Status (Garmin-nativ)
--   usersummary-service/usersummary/daily/{id}      → Stress-Minuten + 7-Tage-Ruhepuls
--   metrics-service/.../trainingstatus/aggregated   → ATL/CTL/ACWR, Training Status, VO2max

-- 1) HRV-Baseline (Garmin pflegt sie rollierend selbst — kein manueller 4-Wochen-Behelf)
ALTER TABLE garmin_sleep ADD COLUMN IF NOT EXISTS hrv_status text;          -- BALANCED / UNBALANCED / LOW / POOR
ALTER TABLE garmin_sleep ADD COLUMN IF NOT EXISTS hrv_baseline_low int;     -- balancedLow (ms)
ALTER TABLE garmin_sleep ADD COLUMN IF NOT EXISTS hrv_baseline_high int;    -- balancedUpper (ms)
ALTER TABLE garmin_sleep ADD COLUMN IF NOT EXISTS hrv_weekly_avg int;       -- 7-Tage-Schnitt (ms)
ALTER TABLE garmin_sleep ADD COLUMN IF NOT EXISTS rhr_7day_avg int;         -- lastSevenDaysAvgRestingHeartRate (bpm)

-- 2) Stress-Minuten (für Stress-Erholungs-Quote SER) — Sekunden → in Minuten gespeichert
ALTER TABLE garmin_body_battery ADD COLUMN IF NOT EXISTS stress_min_low int;
ALTER TABLE garmin_body_battery ADD COLUMN IF NOT EXISTS stress_min_med int;
ALTER TABLE garmin_body_battery ADD COLUMN IF NOT EXISTS stress_min_high int;
ALTER TABLE garmin_body_battery ADD COLUMN IF NOT EXISTS rest_min int;      -- restStressDuration (Erholungs-Minuten)

-- 3) Training Load / Fitness (neue Tabelle, ein Datensatz pro Tag)
CREATE TABLE IF NOT EXISTS garmin_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  date date UNIQUE NOT NULL,
  vo2max numeric,                 -- mostRecentVO2Max.generic.vo2MaxValue
  atl numeric,                    -- dailyTrainingLoadAcute  (akute Last, ~7 Tage)
  ctl numeric,                    -- dailyTrainingLoadChronic (chronische Last, ~28 Tage)
  acwr numeric,                   -- dailyAcuteChronicWorkloadRatio (Goldstandard-Belastungsquote)
  acwr_status text,               -- OPTIMAL / LOW / HIGH / VERY_HIGH
  training_status int,            -- numerischer Garmin-Status
  status_phrase text,             -- z.B. PRODUCTIVE_2, MAINTAINING_1
  created_at timestamptz DEFAULT now()
);

ALTER TABLE garmin_training ENABLE ROW LEVEL SECURITY;
-- Deny-all wie bei den übrigen Garmin-Tabellen; der Service-Role-Key umgeht RLS.
DROP POLICY IF EXISTS garmin_training_deny_all ON garmin_training;
CREATE POLICY garmin_training_deny_all ON garmin_training FOR ALL USING (false) WITH CHECK (false);

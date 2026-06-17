// Auto-populated by Garmin cron
export type GarminActivity = {
  id: string;
  user_id: string;
  activity_id: number | null;
  date: string;
  type: string | null;
  duration_min: number | null;
  distance_km: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  elevation_m: number | null;
  avg_pace: string | null;
  avg_power: number | null;
  max_power: number | null;
  norm_power: number | null;
  name: string | null;
  created_at: string;
};

export type GarminSleep = {
  id: string;
  user_id: string;
  date: string;
  sleep_score: number | null;
  hrv_nightly: number | null;
  total_sleep_min: number | null;
  deep_sleep_min: number | null;
  rem_sleep_min: number | null;
  light_sleep_min: number | null;
  awake_min: number | null;
  resting_hr: number | null;
  hrv_status: string | null;
  hrv_baseline_low: number | null;
  hrv_baseline_high: number | null;
  hrv_weekly_avg: number | null;
  rhr_7day_avg: number | null;
  created_at: string;
};

export type GarminBodyBattery = {
  id: string;
  user_id: string;
  date: string;
  morning_score: number | null;
  evening_score: number | null;
  stress_avg: number | null;
  stress_min_low: number | null;
  stress_min_med: number | null;
  stress_min_high: number | null;
  rest_min: number | null;
  created_at: string;
};

export type GarminTraining = {
  id: string;
  user_id: string;
  date: string;
  vo2max: number | null;
  atl: number | null;
  ctl: number | null;
  acwr: number | null;
  acwr_status: string | null;
  training_status: number | null;
  status_phrase: string | null;
  created_at: string;
};

// Triathlon-Wettkämpfe als Benchmarks (eine Zeile pro Rennen).
// Detail-Zeitreihen via scripts/garmin-activity-hr.mjs aus garmin_activity_id reproduzierbar.
export type TriathlonRace = {
  id: string;
  user_id: string;
  date: string;
  name: string | null;
  location: string | null;
  garmin_activity_id: number | null;
  total_duration_min: number | null;
  total_distance_km: number | null;
  total_elev_gain_m: number | null;
  swim_distance_km: number | null;
  swim_duration_min: number | null;
  swim_avg_hr: number | null;
  swim_max_hr: number | null;
  swim_pace_per_100m: string | null;
  t1_min: number | null;
  t2_min: number | null;
  bike_distance_km: number | null;
  bike_duration_min: number | null;
  bike_avg_hr: number | null;
  bike_max_hr: number | null;
  bike_avg_speed_kmh: number | null;
  bike_elev_gain_m: number | null;
  run_distance_km: number | null;
  run_duration_min: number | null;
  run_avg_hr: number | null;
  run_max_hr: number | null;
  run_avg_pace_min_km: string | null;
  run_elev_gain_m: number | null;
  hrv_morning: number | null;
  rhr_morning: number | null;
  body_battery_morning: number | null;
  sleep_score: number | null;
  notes: string | null;
  created_at: string;
};

// Geplante Trainingseinheiten (Trainingsplan) — Quelle für "Nächste 7 Tage".
export type TrainingPlanSession = {
  id: string;
  user_id: string;
  date: string;
  sport: 'swim' | 'bike' | 'run' | 'strength' | 'brick' | 'rest';
  session_type: string | null;
  title: string;
  is_easy: boolean;
  hf_zone: string | null;
  hf_range: string | null;
  pace_speed: string | null;
  watts_indoor: string | null;
  duration_min: number | null;
  distance_km: number | null;
  details: string | null;
  source: string;
  sort_order: number;
  created_at: string;
};

// Manual entries via dashboard
export type StrengthSession = {
  id: string;
  user_id: string;
  date: string;
  intensity: 1 | 2 | 3;
  session_type: string | null;
  notes: string | null;
  created_at: string;
};

export type DailyHabit = {
  id: string;
  user_id: string;
  date: string;
  habit_name: string;
  completed: boolean;
  created_at: string;
};

// Wiederkehrende Aufgaben (fälligkeits-basiert, statt täglicher Checkliste).
export type RecurringTask = {
  id: string;
  name: string;
  interval_days: number;
  last_done: string | null; // YYYY-MM-DD
  active: boolean;
  sort_order: number;
  created_at: string;
};

// Aufgabe + berechneter Fälligkeits-Status (API-Antwort).
export type RecurringTaskStatus = RecurringTask & {
  due: boolean;
  days_until: number; // 0 = heute fällig, >0 = in N Tagen fällig
};

export type NutritionLog = {
  id: string;
  user_id: string;
  date: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  created_at: string;
};

// Knowledge and research
export type KnowledgeEntry = {
  id: string;
  user_id: string;
  raw_text: string;
  category: string | null;
  summary: string | null;
  tags: string[] | null;
  source: string;
  created_at: string;
};

// Health documents — ausgelesene Werte aus Blutbild / Leistungsdiagnostik
export type HealthLab = {
  id: string;
  user_id: string;
  date: string;
  source_type: "blutbild" | "laktattest" | "befund";
  test_name: string;
  value: number | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  status: "normal" | "low" | "high" | "unknown" | null;
  storage_path: string | null;
  notes: string | null;
  created_at: string;
};

// Music production
export type MusicProject = {
  id: string;
  user_id: string;
  title: string;
  bpm: number | null;
  musical_key: string | null;
  scale: string | null;
  genre: string | null;
  mood: string | null;
  status: "idea" | "wip" | "mixing" | "done" | "released";
  collab: string | null;
  notes: string | null;
  date_started: string;
  updated_at: string;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description: string | null;
  location: string | null;
  source?: string;   // 'training' für eingemischte Plan-Einheiten
  sport?: string;    // run | bike | swim | strength | brick (für Farbcodierung)
};

// Finanzen — Revolut-Import
export type RevolutTransaction = {
  id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount_eur: number;
  currency: string;
  original_amount: number | null;
  original_currency: string | null;
  type: string | null;
  state: string | null;
  category: string | null;
  raw_category: string | null;
  month: string;
  created_at: string;
};

export type ExpenseSummary = {
  id: string;
  month: string;
  category: string;
  total_eur: number;
  transaction_count: number;
  computed_at: string;
};

export type HealthAnalysisResult = {
  id: string;
  type: string;
  period_start: string;
  period_end: string;
  results: Record<string, number>;
  computed_at: string;
};

export type SoundLibrary = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  subcategory: string | null;
  tags: string[] | null;
  bpm: number | null;
  musical_key: string | null;
  file_path: string | null;
  notes: string | null;
  created_at: string;
};

export type LiteraturEntry = {
  id: string;
  user_id: string;
  kw: number;
  jahr: number;
  title: string;
  summary: string | null;
  source_url: string | null;
  source_name: string | null;
  category: string | null;
  tags: string[] | null;
  created_at: string;
};

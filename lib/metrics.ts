import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ── Typisierter Metrik-Dispatcher ─────────────────────────────────────────────
// WICHTIG (CLAUDE.md / Roadmap): Claude bekommt NIEMALS freies SQL. Stattdessen
// wählt es aus einer festen Enum von Metriken + einem Datumsbereich + einem
// Aggregat. Dieser Dispatcher baut daraus parametrisierte PostgREST-Queries.
// supabaseAdmin umgeht RLS — deshalb darf hier nichts frei interpolierbar sein.

// Jede Metrik mappt auf genau eine Tabelle + Zahlen-Spalte.
const METRIC_MAP = {
  // Schlaf (garmin_sleep)
  sleep_score: { table: 'garmin_sleep', column: 'sleep_score', unit: 'Punkte' },
  hrv: { table: 'garmin_sleep', column: 'hrv_nightly', unit: 'ms' },
  sleep_minutes: { table: 'garmin_sleep', column: 'total_sleep_min', unit: 'min' },
  deep_sleep_minutes: { table: 'garmin_sleep', column: 'deep_sleep_min', unit: 'min' },
  rem_sleep_minutes: { table: 'garmin_sleep', column: 'rem_sleep_min', unit: 'min' },
  resting_hr: { table: 'garmin_sleep', column: 'resting_hr', unit: 'bpm' },

  // Aktivitäten (garmin_activities) — optional activity_type-Filter
  activity_duration: { table: 'garmin_activities', column: 'duration_min', unit: 'min' },
  activity_distance: { table: 'garmin_activities', column: 'distance_km', unit: 'km' },
  activity_hr: { table: 'garmin_activities', column: 'avg_hr', unit: 'bpm' },
  activity_calories: { table: 'garmin_activities', column: 'calories', unit: 'kcal' },

  // Body Battery & Stress (garmin_body_battery)
  body_battery_morning: { table: 'garmin_body_battery', column: 'morning_score', unit: 'Punkte' },
  stress: { table: 'garmin_body_battery', column: 'stress_avg', unit: 'Punkte' },

  // Training Load (garmin_training)
  vo2max: { table: 'garmin_training', column: 'vo2max', unit: 'ml/kg/min' },
  acwr: { table: 'garmin_training', column: 'acwr', unit: 'Ratio' },
  ctl: { table: 'garmin_training', column: 'ctl', unit: 'Load' },
  atl: { table: 'garmin_training', column: 'atl', unit: 'Load' },

  // Ernährung (nutrition_logs)
  calories: { table: 'nutrition_logs', column: 'calories', unit: 'kcal' },
  protein: { table: 'nutrition_logs', column: 'protein_g', unit: 'g' },
  carbs: { table: 'nutrition_logs', column: 'carbs_g', unit: 'g' },
  fat: { table: 'nutrition_logs', column: 'fat_g', unit: 'g' },

  // Krafttraining (strength_sessions)
  strength_intensity: { table: 'strength_sessions', column: 'intensity', unit: '1-3' },

  // Laborwerte (health_labs) — erfordert test_name-Filter
  lab_value: { table: 'health_labs', column: 'value', unit: '' },
} as const

export type MetricName = keyof typeof METRIC_MAP
export const METRIC_NAMES = Object.keys(METRIC_MAP) as MetricName[]

export type Aggregate = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'latest' | 'list'
export const AGGREGATES: Aggregate[] = ['sum', 'avg', 'min', 'max', 'count', 'latest', 'list']

// Garmin-Aktivitätstypen, nach denen gefiltert werden kann.
export const ACTIVITY_TYPES = [
  'running', 'cycling', 'swimming', 'strength_training', 'walking', 'other',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export type MetricQuery = {
  metric: MetricName
  from_date: string // YYYY-MM-DD
  to_date: string // YYYY-MM-DD
  aggregate: Aggregate
  activity_type?: ActivityType // nur für activity_* Metriken
  test_name?: string // nur für lab_value
}

export type MetricResult = {
  metric: MetricName
  unit: string
  aggregate: Aggregate
  from_date: string
  to_date: string
  value: number | null
  count: number // Anzahl berücksichtigter (nicht-null) Datenpunkte
  rows?: { date: string; value: number }[] // nur bei aggregate='list'
  note?: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function queryMetric(q: MetricQuery): Promise<MetricResult> {
  const def = METRIC_MAP[q.metric]
  if (!def) throw new Error(`Unbekannte Metrik: ${q.metric}`)

  const base: MetricResult = {
    metric: q.metric,
    unit: def.unit,
    aggregate: q.aggregate,
    from_date: q.from_date,
    to_date: q.to_date,
    value: null,
    count: 0,
  }

  let query = supabaseAdmin
    .from(def.table)
    .select(`date, ${def.column}`)
    .gte('date', q.from_date)
    .lte('date', q.to_date)
    .not(def.column, 'is', null)
    .order('date', { ascending: true })

  // Optionale, typisierte Filter
  if (def.table === 'garmin_activities' && q.activity_type) {
    query = query.eq('type', q.activity_type)
  }
  if (def.table === 'health_labs') {
    if (!q.test_name) {
      return { ...base, note: 'lab_value benötigt einen test_name.' }
    }
    query = query.ilike('test_name', q.test_name)
  }

  const { data, error } = await query
  if (error) {
    console.error('[metrics] query error:', error)
    throw new Error(error.message)
  }

  const rows = ((data ?? []) as Record<string, unknown>[])
    .map((r) => ({
      date: String(r.date),
      value: Number(r[def.column]),
    }))
    .filter((r) => !isNaN(r.value))

  base.count = rows.length
  if (rows.length === 0) {
    return { ...base, note: 'Keine Daten im angegebenen Zeitraum.' }
  }

  const values = rows.map((r) => r.value)

  switch (q.aggregate) {
    case 'sum':
      base.value = round2(values.reduce((a, b) => a + b, 0))
      break
    case 'avg':
      base.value = round2(values.reduce((a, b) => a + b, 0) / values.length)
      break
    case 'min':
      base.value = Math.min(...values)
      break
    case 'max':
      base.value = Math.max(...values)
      break
    case 'count':
      base.value = rows.length
      break
    case 'latest': {
      const last = rows[rows.length - 1]
      base.value = last.value
      base.note = `Stand: ${last.date}`
      break
    }
    case 'list':
      // Bei vielen Zeilen kappen, damit der Tool-Result kompakt bleibt.
      base.rows = rows.slice(-60)
      base.value = null
      break
  }

  return base
}

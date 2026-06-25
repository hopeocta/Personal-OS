/**
 * Täglicher TP-Sync (06:30 UTC) — Workouts + Wellness für alle TP-Personen.
 * Cookie kommt aus Env-Var die pro Person in persons.tp_cookie_env hinterlegt ist.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const maxDuration = 60

const SPORT_MAP: Record<number, string> = {
  1: 'Swim', 2: 'Bike', 3: 'Run', 4: 'Brick', 5: 'Crosstrain',
  6: 'Race', 7: 'Rest', 8: 'MTB', 9: 'Strength', 10: 'Custom',
  11: 'XCSki', 12: 'Rowing', 13: 'Walk', 29: 'Strength', 100: 'Other',
}

const TP_API = 'https://tpapi.trainingpeaks.com'
const WELLNESS_TYPES: Record<number, string> = {
  60: 'hrv_ms', 5: 'resting_hr', 12: 'whoop_raw',
  6: 'sleep_total_h', 46: 'sleep_light_h', 47: 'sleep_deep_h',
  48: 'sleep_rem_h', 49: 'sleep_disturbances', 53: 'spo2_pct',
  58: 'steps', 2: 'weight_kg',
}

async function exchangeCookieForToken(cookie: string): Promise<string | null> {
  const r = await fetch(`${TP_API}/users/v3/token`, {
    headers: { Cookie: `Production_tpAuth=${cookie}`, Accept: 'application/json' },
  })
  if (!r.ok) return null
  const data = await r.json()
  return data?.token?.access_token ?? null
}

async function tpGet(token: string, endpoint: string) {
  const r = await fetch(`${TP_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!r.ok) return null
  return r.json()
}

function workoutToRow(w: Record<string, unknown>, personId: string) {
  const status = (w.totalTime || w.tssActual) ? 'completed' : 'planned'
  return {
    id: w.workoutId,
    person_id: personId,
    workout_day: String(w.workoutDay).substring(0, 10),
    title: w.title ?? null,
    sport: SPORT_MAP[Number(w.workoutTypeValueId)] ?? 'Other',
    workout_type_id: w.workoutTypeValueId ?? null,
    status,
    duration_planned_h: w.totalTimePlanned ?? null,
    distance_planned_km: w.distancePlanned ? Number(w.distancePlanned) / 1000 : null,
    tss_planned: w.tssPlanned ?? null,
    if_planned: w.ifPlanned ?? null,
    description: w.description ?? null,
    coach_comments: w.coachComments ?? null,
    duration_actual_h: w.totalTime ?? null,
    distance_actual_km: w.distance ? Number(w.distance) / 1000 : null,
    tss_actual: w.tssActual ?? null,
    if_actual: w.if ?? null,
    calories: w.calories ?? null,
    hr_avg: w.heartRateAverage ?? null,
    hr_max: w.heartRateMaximum ?? null,
    hr_min: w.heartRateMinimum ?? null,
    velocity_avg_ms: w.velocityAverage ?? null,
    power_avg_w: w.powerAverage ?? null,
    power_norm_w: w.normalizedPowerActual ?? null,
    elevation_gain_m: w.elevationGain ?? null,
    cadence_avg: w.cadenceAverage ?? null,
    synced_to: (w.syncedTo as string[] | null) ?? [],
    rpe: w.rpe ?? null,
    feeling: w.feeling ?? null,
    last_modified: w.lastModifiedDate ?? null,
  }
}

function parseWhoopScore(raw: unknown): number | null {
  try { return parseInt(String(raw).split(':').pop()!.trim()) } catch { return null }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const manualSecret = req.nextUrl.searchParams.get('secret')
  const validCron = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`
  const validManual = process.env.API_SECRET && manualSecret === process.env.API_SECRET
  if (!validCron && !validManual) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Alle TP-Personen laden
  const { data: persons } = await supabaseAdmin
    .from('persons')
    .select('id, tp_athlete_id, tp_cookie_env')
    .eq('data_source', 'tp')
    .eq('active', true)

  if (!persons?.length) return NextResponse.json({ ok: true, synced: 0 })

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(yesterday)

  const results = []
  for (const person of persons) {
    const cookieEnvName = person.tp_cookie_env as string
    const cookie = process.env[cookieEnvName]
    if (!cookie) { results.push({ id: person.id, error: `Env ${cookieEnvName} fehlt` }); continue }

    const token = await exchangeCookieForToken(cookie)
    if (!token) { results.push({ id: person.id, error: 'Token-Exchange fehlgeschlagen' }); continue }

    const athleteId = person.tp_athlete_id

    // Workouts gestern + heute
    const workouts = await tpGet(token, `/fitness/v6/athletes/${athleteId}/workouts/${yd}/${today}`)
    let workoutCount = 0
    if (Array.isArray(workouts)) {
      const rows = workouts.map((w: Record<string, unknown>) => workoutToRow(w, person.id))
      if (rows.length > 0) {
        await supabaseAdmin.from('tp_activities').upsert(rows, { onConflict: 'id' })
        workoutCount = rows.length
      }
    }

    // Wellness heute
    const wellnessData = await tpGet(
      token,
      `/metrics/v3/athletes/${athleteId}/consolidatedtimedmetrics/${today}/${today}`
    )
    let wellnessOk = false
    if (Array.isArray(wellnessData) && wellnessData[0]?.details) {
      const details = wellnessData[0].details as Array<{ type: number; value: unknown }>
      const row: Record<string, unknown> = { person_id: person.id, date: today }
      for (const d of details) {
        const key = WELLNESS_TYPES[d.type]
        if (!key) continue
        if (key === 'whoop_raw') {
          const s = parseWhoopScore(d.value)
          if (s !== null) {
            row.whoop_recovery_score = s
            row.recovery_score = s
            row.recovery_label = s >= 67 ? 'green' : s >= 34 ? 'yellow' : 'red'
          }
        } else {
          row[key] = d.value
        }
      }
      if (Object.keys(row).length > 2) {
        await supabaseAdmin.from('tp_wellness').upsert(row, { onConflict: 'person_id,date' })
        wellnessOk = true
      }
    }

    results.push({ id: person.id, workouts: workoutCount, wellness: wellnessOk })
  }

  return NextResponse.json({ ok: true, results, date: today })
}

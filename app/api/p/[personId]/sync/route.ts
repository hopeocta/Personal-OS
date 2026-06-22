import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const maxDuration = 30

const TP_API = 'https://tpapi.trainingpeaks.com'

const SPORT_MAP: Record<number, string> = {
  1: 'Swim', 2: 'Bike', 3: 'Run', 4: 'Brick', 5: 'Crosstrain',
  6: 'Race', 7: 'Rest', 8: 'MTB', 9: 'Strength', 10: 'Custom',
  11: 'XCSki', 12: 'Rowing', 13: 'Walk', 29: 'Strength', 100: 'Other',
}

const WELLNESS_TYPES: Record<number, string> = {
  60: 'hrv_ms', 5: 'resting_hr', 12: 'whoop_raw',
  6: 'sleep_total_h', 46: 'sleep_light_h', 47: 'sleep_deep_h',
  48: 'sleep_rem_h', 49: 'sleep_disturbances', 53: 'spo2_pct',
  58: 'steps', 2: 'weight_kg',
}

function parseWhoopScore(raw: unknown): number | null {
  try { return parseInt(String(raw).split(':').pop()!.trim()) } catch { return null }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params

  const { data: person } = await supabaseAdmin
    .from('persons')
    .select('tp_athlete_id, tp_cookie_env, data_source')
    .eq('id', personId)
    .maybeSingle()

  if (!person || person.data_source !== 'tp') {
    return NextResponse.json({ error: 'Kein TP-Athlet' }, { status: 400 })
  }

  const cookie = process.env[person.tp_cookie_env as string]
  if (!cookie) {
    return NextResponse.json({ error: `Env ${person.tp_cookie_env} nicht gesetzt` }, { status: 500 })
  }

  // Token holen
  const tokenRes = await fetch(`${TP_API}/users/v3/token`, {
    headers: { Cookie: `Production_tpAuth=${cookie}`, Accept: 'application/json' },
  })
  if (!tokenRes.ok) return NextResponse.json({ error: 'Token-Exchange fehlgeschlagen' }, { status: 502 })
  const tokenData = await tokenRes.json()
  const token = tokenData?.token?.access_token
  if (!token) return NextResponse.json({ error: 'Kein Token' }, { status: 502 })

  const athleteId = person.tp_athlete_id
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const from = new Date(); from.setDate(from.getDate() - 7)
  const fromStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(from)

  // Workouts letzte 7 Tage
  const wRes = await fetch(`${TP_API}/fitness/v6/athletes/${athleteId}/workouts/${fromStr}/${today}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  let workoutCount = 0
  if (wRes.ok) {
    const workouts = await wRes.json()
    if (Array.isArray(workouts)) {
      const rows = workouts.map((w: Record<string, unknown>) => ({
        id: w.workoutId,
        person_id: personId,
        workout_day: String(w.workoutDay).substring(0, 10),
        title: w.title ?? null,
        sport: SPORT_MAP[Number(w.workoutTypeValueId)] ?? 'Other',
        workout_type_id: w.workoutTypeValueId ?? null,
        status: (w.totalTime || w.tssActual) ? 'completed' : 'planned',
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
      }))
      if (rows.length > 0) {
        await supabaseAdmin.from('tp_activities').upsert(rows, { onConflict: 'id' })
        workoutCount = rows.filter(r => r.status === 'completed').length
      }
    }
  }

  // Wellness heute
  const wlRes = await fetch(
    `${TP_API}/metrics/v3/athletes/${athleteId}/consolidatedtimedmetrics/${today}/${today}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  )
  let wellnessOk = false
  if (wlRes.ok) {
    const wlData = await wlRes.json()
    if (Array.isArray(wlData) && wlData[0]?.details) {
      const details = wlData[0].details as Array<{ type: number; value: unknown }>
      const row: Record<string, unknown> = { person_id: personId, date: today }
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
        const allKeys = ['person_id','date','hrv_ms','resting_hr','whoop_recovery_score','recovery_score','recovery_label','sleep_total_h','sleep_light_h','sleep_deep_h','sleep_rem_h','sleep_disturbances','spo2_pct','steps','weight_kg']
        for (const k of allKeys) row[k] = row[k] ?? null
        await supabaseAdmin.from('tp_wellness').upsert(row, { onConflict: 'person_id,date' })
        wellnessOk = true
      }
    }
  }

  return NextResponse.json({ ok: true, workouts: workoutCount, wellness: wellnessOk, date: today })
}

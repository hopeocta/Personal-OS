import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

const TP_MATCH: Record<string, string[]> = {
  running: ['Run'], cycling: ['Bike'], swimming: ['Swim'], strength: ['Strength'],
}
const GARMIN_MATCH: Record<string, string[]> = {
  running: ['running', 'trail_running', 'treadmill_running'],
  cycling: ['cycling', 'indoor_cycling', 'road_biking', 'e_bike_fitness', 'virtual_ride'],
  swimming: ['lap_swimming', 'open_water_swimming'],
  strength: ['strength_training', 'functional_strength_training'],
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params
  const today = berlinToday()
  const wkStart = weekStart(today)

  const { data: person } = await supabaseAdmin
    .from('persons')
    .select('data_source')
    .eq('id', personId)
    .maybeSingle()

  const dataSource = (person?.data_source as string | null) ?? 'garmin'

  const [
    { data: planSessions },
    { data: tpActs },
    { data: garminActs },
    { data: wellness },
    { data: lastTpAct },
  ] = await Promise.all([
    supabaseAdmin
      .from('training_plan_sessions')
      .select('date, sport, title, duration_min, is_optional')
      .eq('user_id', personId)
      .gte('date', wkStart)
      .lte('date', today)
      .order('date'),
    dataSource === 'tp'
      ? supabaseAdmin.from('tp_activities')
          .select('workout_day, sport')
          .eq('person_id', personId)
          .eq('status', 'completed')
          .gte('workout_day', wkStart)
          .lte('workout_day', today)
      : Promise.resolve({ data: null }),
    dataSource !== 'tp'
      ? supabaseAdmin.from('garmin_activities')
          .select('date, type')
          .eq('user_id', personId)
          .not('type', 'in', '("walking","uncategorized_activity","generic")')
          .gte('date', wkStart)
          .lte('date', today)
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from('tp_wellness')
      .select('date, whoop_recovery_score, whoop_hrv, sleep_score')
      .eq('person_id', personId)
      .not('whoop_recovery_score', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Letzter TP-Sync-Zeitpunkt
    supabaseAdmin
      .from('tp_activities')
      .select('workout_day')
      .eq('person_id', personId)
      .eq('status', 'completed')
      .order('workout_day', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Done-Index: Datum → done sports
  const doneByDate: Record<string, string[]> = {}
  if (dataSource === 'tp') {
    for (const a of tpActs ?? []) {
      const d = String(a.workout_day)
      ;(doneByDate[d] ??= []).push(String(a.sport))
    }
  } else {
    for (const a of garminActs ?? []) {
      const d = String(a.date)
      ;(doneByDate[d] ??= []).push(String(a.type))
    }
  }

  // Per-Sport Zusammenfassung (nur Pflicht-Sessions bis heute)
  const sportMap: Record<string, { planned: number; done: number; totalMin: number; sessions: { date: string; title: string; done: boolean }[] }> = {}
  for (const s of planSessions ?? []) {
    if (s.is_optional || s.sport === 'rest') continue
    const sp = String(s.sport)
    if (!sportMap[sp]) sportMap[sp] = { planned: 0, done: 0, totalMin: 0, sessions: [] }
    sportMap[sp].planned++
    sportMap[sp].totalMin += Number(s.duration_min ?? 0)
    const matchTypes = dataSource === 'tp' ? (TP_MATCH[sp] ?? []) : (GARMIN_MATCH[sp] ?? [])
    const isDone = (doneByDate[String(s.date)] ?? []).some(t => matchTypes.includes(t))
    if (isDone) sportMap[sp].done++
    sportMap[sp].sessions.push({ date: String(s.date), title: String(s.title), done: isDone })
  }

  const bySpot = Object.entries(sportMap).map(([sport, v]) => ({ sport, ...v }))
  const totalPlanned = bySpot.reduce((n, s) => n + s.planned, 0)
  const totalDone = bySpot.reduce((n, s) => n + s.done, 0)

  // TP-Sync-Alter in Tagen
  const lastSyncDate = lastTpAct?.workout_day as string | null
  const syncAgeDays = lastSyncDate
    ? Math.floor((new Date(today).getTime() - new Date(lastSyncDate).getTime()) / 86400000)
    : null

  return NextResponse.json({
    wkStart,
    today,
    bySport: bySpot,
    totalPlanned,
    totalDone,
    whoop: wellness?.whoop_recovery_score ?? null,
    whoopHrv: wellness?.whoop_hrv ?? null,
    whoopDate: wellness?.date ?? null,
    lastSyncDate,
    syncAgeDays,
    syncOnline: syncAgeDays !== null && syncAgeDays <= 3,
  })
}

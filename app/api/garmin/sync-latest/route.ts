import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getGarminClient } from '@/lib/garminClient'

function isIndoor(typeKey: string | null | undefined): boolean {
  return (typeKey ?? '').includes('indoor')
}
function toInt(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}
function fmtSpeed(ms: number | null | undefined): string | null {
  if (ms == null) return null
  return `${Math.round(ms * 3.6 * 10) / 10} km/h`
}

// Lightweight variant of the daily Garmin sync — fetches only the last 5
// activities and upserts them. Called on-demand from the mobile "Sync" button
// so a just-finished activity shows up immediately without waiting for the
// 5:00 UTC cron. Intentionally no CRON_SECRET check (same as all /api/garmin/*
// routes which are already exempt from the session middleware).
export async function POST() {
  let client
  try {
    client = await getGarminClient('me')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sync-latest] auth error:', msg)
    return NextResponse.json({ error: `Auth: ${msg}` }, { status: 500 })
  }

  try {
    const activities = await client.getActivities(0, 5)
    for (const a of activities) {
      const date = a.startTimeLocal.split(' ')[0]
      const typeKey = a.activityType?.typeKey ?? null
      const indoor = isIndoor(typeKey)
      const { error } = await supabaseAdmin.from('garmin_activities').upsert(
        {
          activity_id: a.activityId,
          date,
          type: typeKey,
          duration_min: a.duration != null ? Math.round(a.duration / 60) : null,
          distance_km: a.distance != null ? Math.round(a.distance / 10) / 100 : null,
          avg_hr: a.averageHR ?? null,
          max_hr: a.maxHR ?? null,
          calories: a.calories ?? null,
          elevation_m: a.elevationGain != null ? Math.round(a.elevationGain) : null,
          avg_pace: fmtSpeed(a.averageSpeed),
          avg_power: indoor ? toInt(a.avgPower) : null,
          max_power: indoor ? toInt(a.maxPower) : null,
          norm_power: indoor ? toInt(a.normPower) : null,
          name: a.activityName ?? null,
        },
        { onConflict: 'activity_id' }
      )
      if (error) console.error('[sync-latest] upsert error:', error)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sync-latest] activities fetch error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Return the freshest activity from DB
  const { data } = await supabaseAdmin
    .from('garmin_activities')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ activity: data })
}

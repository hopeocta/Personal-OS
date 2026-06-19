import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getGarminClient } from '@/lib/garminClient'

export const runtime = 'nodejs'

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function fmtSpeed(ms: number | null): string | null {
  if (ms == null) return null
  return `${Math.round(ms * 3.6 * 10) / 10} km/h`
}

// Watt-Werte liefert Garmin nur für Indoor-Aktivitäten (Smarttrainer/Powermeter).
function isIndoor(typeKey: string | null | undefined): boolean {
  return (typeKey ?? '').includes('indoor')
}

function toInt(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = parseInt(searchParams.get('start') ?? '0', 10)
  const months = parseInt(searchParams.get('months') ?? '12', 10)
  const BATCH = 100

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)

  let GCClient
  try {
    GCClient = await getGarminClient('me')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Garmin login error:', msg)
    return NextResponse.json({ error: `Garmin login failed: ${msg}` }, { status: 500 })
  }

  const errors: string[] = []
  let synced = 0
  let skipped = 0

  const activities = await GCClient.getActivities(start, BATCH).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`getActivities: ${msg}`)
    return []
  })

  for (const a of activities) {
    const actDate = new Date(a.startTimeLocal)
    if (actDate < cutoff) {
      skipped++
      continue
    }
    const date = a.startTimeLocal.split(' ')[0] ?? dateStr(actDate)
    const typeKey = a.activityType?.typeKey ?? null
    const indoor = isIndoor(typeKey)
    const { error } = await supabaseAdmin
      .from('garmin_activities')
      .upsert(
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
    if (error) {
      console.error('upsert error:', error)
      errors.push(`Activity ${a.activityId}: ${error.message}`)
    } else {
      synced++
    }
  }

  // done = got fewer than BATCH results, or all remaining were older than cutoff
  const done = activities.length < BATCH || skipped > 0
  const next_start = start + BATCH

  return NextResponse.json({
    synced,
    skipped_old: skipped,
    batch_start: start,
    done,
    next_start: done ? null : next_start,
    errors,
  })
}

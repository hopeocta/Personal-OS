import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getGarminClient } from '@/lib/garminClient'
import { fetchDailyStress } from '@/lib/garminWellness'

export const runtime = 'nodejs'
export const maxDuration = 300

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// Day-by-day backfill of sleep, body battery and stress. Garmin exposes these
// per calendar day (one request each), so we process a batch of days per call
// and the caller pages back through the year via the returned next_offset.
//   ?offset=0&days=30   → backfills the 30 days ending `offset` days ago
//   total window capped at 12 months (365 days)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const days = Math.min(60, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10)))
  const MAX_DAYS = 365

  let GCClient
  try {
    GCClient = await getGarminClient()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Garmin login error:', msg)
    return NextResponse.json({ error: `Garmin login failed: ${msg}` }, { status: 500 })
  }

  const errors: string[] = []
  let synced_sleep = 0
  let synced_body_battery = 0

  const end = Math.min(offset + days, MAX_DAYS)

  for (let back = offset; back < end; back++) {
    const day = new Date()
    day.setDate(day.getDate() - back)
    const ds = dateStr(day)

    // Sleep
    try {
      const sleepData = await GCClient.getSleepData(day)
      const dto = sleepData?.dailySleepDTO

      if (dto && dto.sleepTimeSeconds != null) {
        const { error: sleepErr } = await supabaseAdmin
          .from('garmin_sleep')
          .upsert(
            {
              date: ds,
              sleep_score: dto.sleepScores?.overall?.value ?? null,
              hrv_nightly: sleepData.avgOvernightHrv ?? null,
              total_sleep_min: dto.sleepTimeSeconds != null ? Math.round(dto.sleepTimeSeconds / 60) : null,
              deep_sleep_min: dto.deepSleepSeconds != null ? Math.round(dto.deepSleepSeconds / 60) : null,
              rem_sleep_min: dto.remSleepSeconds != null ? Math.round(dto.remSleepSeconds / 60) : null,
              light_sleep_min: dto.lightSleepSeconds != null ? Math.round(dto.lightSleepSeconds / 60) : null,
              awake_min: dto.awakeSleepSeconds != null ? Math.round(dto.awakeSleepSeconds / 60) : null,
            },
            { onConflict: 'date' }
          )
        if (sleepErr) {
          console.error(`garmin_sleep upsert error (${ds}):`, sleepErr)
          errors.push(`Sleep ${ds}: ${sleepErr.message}`)
        } else {
          synced_sleep++
        }
      }

      // Body battery (from sleep response) + stress (separate endpoint)
      const bb = sleepData?.sleepBodyBattery
      const morningScore = Array.isArray(bb) && bb.length > 0 ? (bb[0]?.value ?? null) : null
      const eveningScore = Array.isArray(bb) && bb.length > 0 ? (bb[bb.length - 1]?.value ?? null) : null

      let stressAvg: number | null = null
      try {
        const stress = await fetchDailyStress(GCClient, day)
        stressAvg = stress.avgStress
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Stress fetch error (${ds}):`, msg)
        errors.push(`Stress ${ds}: ${msg}`)
      }

      if (morningScore != null || eveningScore != null || stressAvg != null) {
        const { error: bbErr } = await supabaseAdmin
          .from('garmin_body_battery')
          .upsert(
            {
              date: ds,
              morning_score: morningScore,
              evening_score: eveningScore,
              stress_avg: stressAvg,
            },
            { onConflict: 'date' }
          )
        if (bbErr) {
          console.error(`garmin_body_battery upsert error (${ds}):`, bbErr)
          errors.push(`Body battery ${ds}: ${bbErr.message}`)
        } else {
          synced_body_battery++
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Sleep fetch error (${ds}):`, msg)
      errors.push(`Sleep ${ds}: ${msg}`)
    }
  }

  const done = end >= MAX_DAYS
  return NextResponse.json({
    synced_sleep,
    synced_body_battery,
    range: { from: end - 1, to: offset },
    done,
    next_offset: done ? null : end,
    errors,
  })
}

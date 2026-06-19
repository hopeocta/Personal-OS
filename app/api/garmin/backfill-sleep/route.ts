import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getGarminClient } from '@/lib/garminClient'
import {
  fetchDailyStress,
  fetchHrvSummary,
  fetchDailySummary,
  fetchTrainingStatus,
} from '@/lib/garminWellness'

export const runtime = 'nodejs'
export const maxDuration = 300

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// Day-by-day backfill of recovery & load metrics. Per day we hit several Garmin
// endpoints (sleep, HRV baseline, daily summary for stress minutes + 7d RHR,
// daily stress, training status). Garmin exposes these per calendar day, so we
// process a batch of days per call and the caller pages back through the year
// via the returned next_offset.
//   ?offset=0&days=30   → backfills the 30 days ending `offset` days ago
//   total window capped at 12 months (365 days)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const days = Math.min(60, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10)))
  const userId = searchParams.get('person') ?? 'me'
  const MAX_DAYS = 365

  let GCClient
  try {
    GCClient = await getGarminClient(userId)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Garmin login error:', msg)
    return NextResponse.json({ error: `Garmin login failed: ${msg}` }, { status: 500 })
  }

  // displayName (user hash) is needed for the daily-summary endpoint; fetch once.
  let displayName = ''
  try {
    const profile = await GCClient.getUserProfile()
    displayName = (profile as { displayName?: string })?.displayName ?? ''
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('getUserProfile error:', msg)
  }

  const errors: string[] = []
  let synced_sleep = 0
  let synced_body_battery = 0
  let synced_training = 0

  const end = Math.min(offset + days, MAX_DAYS)

  for (let back = offset; back < end; back++) {
    const day = new Date()
    day.setDate(day.getDate() - back)
    const ds = dateStr(day)

    // HRV baseline & status (Garmin-native) — used to enrich the sleep row.
    let hrv: Awaited<ReturnType<typeof fetchHrvSummary>> = {
      status: null, baselineLow: null, baselineHigh: null, weeklyAvg: null,
    }
    try {
      hrv = await fetchHrvSummary(GCClient, day)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`HRV fetch error (${ds}):`, msg)
      errors.push(`HRV ${ds}: ${msg}`)
    }

    // Daily summary: stress minutes (for SER) + 7-day resting HR baseline.
    let summary: Awaited<ReturnType<typeof fetchDailySummary>> = {
      stressMinLow: null, stressMinMed: null, stressMinHigh: null, restMin: null, rhr7day: null,
    }
    if (displayName) {
      try {
        summary = await fetchDailySummary(GCClient, day, displayName)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Daily summary fetch error (${ds}):`, msg)
        errors.push(`Summary ${ds}: ${msg}`)
      }
    }

    // Sleep
    try {
      const sleepData = await GCClient.getSleepData(day)
      const dto = sleepData?.dailySleepDTO

      if (dto && dto.sleepTimeSeconds != null) {
        const { error: sleepErr } = await supabaseAdmin
          .from('garmin_sleep')
          .upsert(
            {
              user_id: userId,
              date: ds,
              sleep_score: dto.sleepScores?.overall?.value ?? null,
              hrv_nightly: sleepData.avgOvernightHrv ?? null,
              total_sleep_min: dto.sleepTimeSeconds != null ? Math.round(dto.sleepTimeSeconds / 60) : null,
              deep_sleep_min: dto.deepSleepSeconds != null ? Math.round(dto.deepSleepSeconds / 60) : null,
              rem_sleep_min: dto.remSleepSeconds != null ? Math.round(dto.remSleepSeconds / 60) : null,
              light_sleep_min: dto.lightSleepSeconds != null ? Math.round(dto.lightSleepSeconds / 60) : null,
              awake_min: dto.awakeSleepSeconds != null ? Math.round(dto.awakeSleepSeconds / 60) : null,
              resting_hr: sleepData.restingHeartRate ?? null,
              hrv_status: hrv.status,
              hrv_baseline_low: hrv.baselineLow,
              hrv_baseline_high: hrv.baselineHigh,
              hrv_weekly_avg: hrv.weeklyAvg,
              rhr_7day_avg: summary.rhr7day,
            },
            { onConflict: 'user_id,date' }
          )
        if (sleepErr) {
          console.error(`garmin_sleep upsert error (${ds}):`, sleepErr)
          errors.push(`Sleep ${ds}: ${sleepErr.message}`)
        } else {
          synced_sleep++
        }
      }

      // Body battery (from sleep response) + stress avg + stress minutes.
      // sleepBodyBattery is chronological: [0] = sleep onset (evening, low),
      // [last] = wake (morning, recharged). "morning" = last, "evening" = first.
      const bb = sleepData?.sleepBodyBattery
      const eveningScore = Array.isArray(bb) && bb.length > 0 ? (bb[0]?.value ?? null) : null
      const morningScore = Array.isArray(bb) && bb.length > 0 ? (bb[bb.length - 1]?.value ?? null) : null

      let stressAvg: number | null = null
      try {
        const stress = await fetchDailyStress(GCClient, day)
        stressAvg = stress.avgStress
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Stress fetch error (${ds}):`, msg)
        errors.push(`Stress ${ds}: ${msg}`)
      }

      const hasBody =
        morningScore != null || eveningScore != null || stressAvg != null ||
        summary.stressMinLow != null || summary.restMin != null
      if (hasBody) {
        const { error: bbErr } = await supabaseAdmin
          .from('garmin_body_battery')
          .upsert(
            {
              user_id: userId,
              date: ds,
              morning_score: morningScore,
              evening_score: eveningScore,
              stress_avg: stressAvg,
              stress_min_low: summary.stressMinLow,
              stress_min_med: summary.stressMinMed,
              stress_min_high: summary.stressMinHigh,
              rest_min: summary.restMin,
            },
            { onConflict: 'user_id,date' }
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

    // Training load / fitness (separate table)
    try {
      const t = await fetchTrainingStatus(GCClient, day)
      if (
        t.vo2max != null || t.atl != null || t.ctl != null ||
        t.acwr != null || t.trainingStatus != null
      ) {
        const { error: tErr } = await supabaseAdmin
          .from('garmin_training')
          .upsert(
            {
              user_id: userId,
              date: ds,
              vo2max: t.vo2max,
              atl: t.atl,
              ctl: t.ctl,
              acwr: t.acwr,
              acwr_status: t.acwrStatus,
              training_status: t.trainingStatus,
              status_phrase: t.statusPhrase,
            },
            { onConflict: 'user_id,date' }
          )
        if (tErr) {
          console.error(`garmin_training upsert error (${ds}):`, tErr)
          errors.push(`Training ${ds}: ${tErr.message}`)
        } else {
          synced_training++
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Training status fetch error (${ds}):`, msg)
      errors.push(`Training ${ds}: ${msg}`)
    }
  }

  const done = end >= MAX_DAYS
  return NextResponse.json({
    synced_sleep,
    synced_body_battery,
    synced_training,
    range: { from: end - 1, to: offset },
    done,
    next_offset: done ? null : end,
    errors,
  })
}

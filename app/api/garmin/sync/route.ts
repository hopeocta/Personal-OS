import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getGarminClient } from '@/lib/garminClient'
import {
  fetchDailyStress,
  fetchHrvSummary,
  fetchDailySummary,
  fetchTrainingStatus,
} from '@/lib/garminWellness'
import { appendToDailyLog, berlinNow } from '@/lib/obsidian'

export const runtime = 'nodejs'

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function fmtSpeed(ms: number | null): string | null {
  if (ms == null) return null
  return `${Math.round(ms * 3.6 * 10) / 10} km/h`
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const errors: string[] = []
  let synced_activities = 0
  let synced_sleep = 0
  let synced_body_battery = 0
  let synced_training = 0

  // Für das tägliche Logbuch: Aktivitäts- und Schlaf-Zeilen pro Tag sammeln.
  const garminLog = new Map<string, { activities: string[]; sleep: string | null }>()
  function logDay(ds: string) {
    if (!garminLog.has(ds)) garminLog.set(ds, { activities: [], sleep: null })
    return garminLog.get(ds)!
  }

  let GCClient
  try {
    GCClient = await getGarminClient()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Garmin login error:', msg)
    return NextResponse.json(
      { synced_activities, synced_sleep, synced_body_battery, synced_training, errors: [`Auth: ${msg}`] },
      { status: 500 }
    )
  }

  // displayName (user hash) for the daily-summary endpoint; fetch once.
  let displayName = ''
  try {
    const profile = await GCClient.getUserProfile()
    displayName = (profile as { displayName?: string })?.displayName ?? ''
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('getUserProfile error:', msg)
  }

  const today = new Date()
  const yesterday = daysAgo(1)
  const cutoff = daysAgo(2)

  // Activities — fetch last 30, filter to last 2 days
  try {
    const activities = await GCClient.getActivities(0, 30)
    const recent = activities.filter((a) => new Date(a.startTimeLocal) >= cutoff)
    for (const a of recent) {
      const date = a.startTimeLocal.split(' ')[0] ?? dateStr(new Date(a.startTimeLocal))
      const { error } = await supabaseAdmin
        .from('garmin_activities')
        .upsert(
          {
            activity_id: a.activityId,
            date,
            type: a.activityType?.typeKey ?? null,
            duration_min: a.duration != null ? Math.round(a.duration / 60) : null,
            distance_km: a.distance != null ? Math.round(a.distance / 10) / 100 : null,
            avg_hr: a.averageHR ?? null,
            max_hr: a.maxHR ?? null,
            calories: a.calories ?? null,
            elevation_m: a.elevationGain != null ? Math.round(a.elevationGain) : null,
            avg_pace: fmtSpeed(a.averageSpeed),
            name: a.activityName ?? null,
          },
          { onConflict: 'activity_id' }
        )
      if (error) {
        console.error('garmin_activities upsert error:', error)
        errors.push(`Activity ${a.activityId}: ${error.message}`)
      } else {
        synced_activities++
        const typeLabels: Record<string, string> = {
          running: 'Laufen', cycling: 'Radfahren', swimming: 'Schwimmen',
          strength_training: 'Krafttraining', walking: 'Gehen', hiking: 'Wandern',
          open_water_swimming: 'Freiwasserschwimmen', trail_running: 'Trail',
        }
        const typeLabel = typeLabels[a.activityType?.typeKey ?? ''] ?? (a.activityType?.typeKey ?? 'Training').replace(/_/g, ' ')
        const km = a.distance != null ? `${(a.distance / 1000).toFixed(1).replace('.', ',')} km` : null
        const min = a.duration != null ? `${Math.round(a.duration / 60)} min` : null
        const hr = a.averageHR != null ? `Ø${a.averageHR} bpm` : null
        const actLine = [typeLabel, km, min, hr].filter(Boolean).join(' · ')
        logDay(date).activities.push(actLine)
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Activities fetch error:', msg)
    errors.push(`Activities: ${msg}`)
  }

  // Sleep + body battery + recovery/load — today and yesterday (timezone edge cases)
  for (const day of [today, yesterday]) {
    const ds = dateStr(day)

    // HRV baseline & 7-day RHR (Garmin-native) — enrich the sleep row.
    let hrv = { status: null as string | null, baselineLow: null as number | null, baselineHigh: null as number | null, weeklyAvg: null as number | null }
    try {
      hrv = await fetchHrvSummary(GCClient, day)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`HRV fetch error (${ds}):`, msg)
      errors.push(`HRV ${ds}: ${msg}`)
    }

    let summary = { stressMinLow: null as number | null, stressMinMed: null as number | null, stressMinHigh: null as number | null, restMin: null as number | null, rhr7day: null as number | null }
    if (displayName) {
      try {
        summary = await fetchDailySummary(GCClient, day, displayName)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Daily summary fetch error (${ds}):`, msg)
        errors.push(`Summary ${ds}: ${msg}`)
      }
    }

    try {
      const sleepData = await GCClient.getSleepData(day)
      const dto = sleepData?.dailySleepDTO

      if (dto) {
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
              resting_hr: sleepData.restingHeartRate ?? null,
              hrv_status: hrv.status,
              hrv_baseline_low: hrv.baselineLow,
              hrv_baseline_high: hrv.baselineHigh,
              hrv_weekly_avg: hrv.weeklyAvg,
              rhr_7day_avg: summary.rhr7day,
            },
            { onConflict: 'date' }
          )
        if (sleepErr) {
          console.error('garmin_sleep upsert error:', sleepErr)
          errors.push(`Sleep ${ds}: ${sleepErr.message}`)
        } else {
          synced_sleep++
          const totalMin = dto.sleepTimeSeconds != null ? Math.round(dto.sleepTimeSeconds / 60) : null
          const hStr = totalMin != null ? `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}` : null
          const score = dto.sleepScores?.overall?.value ?? null
          const hrvVal = sleepData.avgOvernightHrv ?? null
          const hrvStatus = hrv.status ? ` (${hrv.status})` : ''
          const sleepLine = ['Schlaf', hStr, score != null ? `Score ${score}` : null, hrvVal != null ? `HRV ${hrvVal}${hrvStatus}` : null].filter(Boolean).join(' · ')
          logDay(ds).sleep = sleepLine
        }
      }

      // Stress from the dedicated dailyStress endpoint (not in sleep response)
      let stressAvg: number | null = null
      try {
        const stress = await fetchDailyStress(GCClient, day)
        stressAvg = stress.avgStress
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Stress fetch error (${ds}):`, msg)
        errors.push(`Stress ${ds}: ${msg}`)
      }

      // Body battery comes from sleepBodyBattery array in sleep response.
      // Chronological: [0] = sleep onset (evening, low), [last] = wake (morning, recharged).
      const bb = sleepData?.sleepBodyBattery
      if (Array.isArray(bb) && bb.length > 0) {
        const eveningScore = bb[0]?.value ?? null
        const morningScore = bb[bb.length - 1]?.value ?? null
        const { error: bbErr } = await supabaseAdmin
          .from('garmin_body_battery')
          .upsert(
            {
              date: ds,
              morning_score: morningScore,
              evening_score: eveningScore,
              stress_avg: stressAvg,
              stress_min_low: summary.stressMinLow,
              stress_min_med: summary.stressMinMed,
              stress_min_high: summary.stressMinHigh,
              rest_min: summary.restMin,
            },
            { onConflict: 'date' }
          )
        if (bbErr) {
          console.error('garmin_body_battery upsert error:', bbErr)
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
      if (t.vo2max != null || t.atl != null || t.ctl != null || t.acwr != null || t.trainingStatus != null) {
        const { error: tErr } = await supabaseAdmin
          .from('garmin_training')
          .upsert(
            {
              date: ds,
              vo2max: t.vo2max,
              atl: t.atl,
              ctl: t.ctl,
              acwr: t.acwr,
              acwr_status: t.acwrStatus,
              training_status: t.trainingStatus,
              status_phrase: t.statusPhrase,
            },
            { onConflict: 'date' }
          )
        if (tErr) {
          console.error('garmin_training upsert error:', tErr)
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

  // Tägliches Logbuch: eine Garmin-Sektion pro Tag schreiben (ersetzt bei Re-Sync)
  const { timeBerlin } = berlinNow()
  for (const [dateKey, data] of garminLog) {
    const lines = [...data.activities, ...(data.sleep ? [data.sleep] : [])]
    if (lines.length > 0) {
      void appendToDailyLog({ kind: 'garmin', timeBerlin, dateKey, content: lines.join('\n') })
    }
  }

  return NextResponse.json({ synced_activities, synced_sleep, synced_body_battery, synced_training, errors })
}

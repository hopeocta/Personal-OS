import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getGarminClient } from '@/lib/garminClient'
import { fetchDailyStress } from '@/lib/garminWellness'

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

  let GCClient
  try {
    GCClient = await getGarminClient()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Garmin login error:', msg)
    return NextResponse.json(
      { synced_activities, synced_sleep, synced_body_battery, errors: [`Auth: ${msg}`] },
      { status: 500 }
    )
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
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Activities fetch error:', msg)
    errors.push(`Activities: ${msg}`)
  }

  // Sleep + body battery — today and yesterday (timezone edge cases)
  for (const day of [today, yesterday]) {
    try {
      const sleepData = await GCClient.getSleepData(day)
      const dto = sleepData?.dailySleepDTO

      if (dto) {
        const { error: sleepErr } = await supabaseAdmin
          .from('garmin_sleep')
          .upsert(
            {
              date: dateStr(day),
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
          console.error('garmin_sleep upsert error:', sleepErr)
          errors.push(`Sleep ${dateStr(day)}: ${sleepErr.message}`)
        } else {
          synced_sleep++
        }
      }

      // Stress from the dedicated dailyStress endpoint (not in sleep response)
      let stressAvg: number | null = null
      try {
        const stress = await fetchDailyStress(GCClient, day)
        stressAvg = stress.avgStress
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Stress fetch error (${dateStr(day)}):`, msg)
        errors.push(`Stress ${dateStr(day)}: ${msg}`)
      }

      // Body battery comes from sleepBodyBattery array in sleep response
      const bb = sleepData?.sleepBodyBattery
      if (Array.isArray(bb) && bb.length > 0) {
        const morningScore = bb[0]?.value ?? null
        const eveningScore = bb[bb.length - 1]?.value ?? null
        const { error: bbErr } = await supabaseAdmin
          .from('garmin_body_battery')
          .upsert(
            {
              date: dateStr(day),
              morning_score: morningScore,
              evening_score: eveningScore,
              stress_avg: stressAvg,
            },
            { onConflict: 'date' }
          )
        if (bbErr) {
          console.error('garmin_body_battery upsert error:', bbErr)
          errors.push(`Body battery ${dateStr(day)}: ${bbErr.message}`)
        } else {
          synced_body_battery++
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`Sleep fetch error (${dateStr(day)}):`, msg)
      errors.push(`Sleep ${dateStr(day)}: ${msg}`)
    }
  }

  return NextResponse.json({ synced_activities, synced_sleep, synced_body_battery, errors })
}

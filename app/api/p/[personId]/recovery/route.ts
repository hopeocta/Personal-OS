import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params

  // Heute + letzte 30 Tage Wellness
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fromDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(thirtyDaysAgo)

  const { data: wellness } = await supabaseAdmin
    .from('tp_wellness')
    .select('date, whoop_recovery_score, hrv_ms, resting_hr, sleep_total_h, sleep_deep_h, sleep_rem_h, sleep_light_h, sleep_disturbances, recovery_label')
    .eq('person_id', personId)
    .gte('date', fromDate)
    .lte('date', today)
    .order('date', { ascending: false })

  if (!wellness || wellness.length === 0) {
    return NextResponse.json({ today: null, trend: [] })
  }

  const todayEntry = wellness[0]?.date === today ? wellness[0] : null
  const last7 = wellness.slice(0, 7)

  // HRV-Baseline (30-Tage-Median)
  const hrvValues = wellness.map(w => w.hrv_ms).filter(Boolean) as number[]
  hrvValues.sort((a, b) => a - b)
  const hrvBaseline = hrvValues.length > 0
    ? Math.round(hrvValues[Math.floor(hrvValues.length / 2)])
    : null

  // Resting HR 7-Tage-Trend
  const rhrValues = last7.map(w => w.resting_hr).filter(Boolean) as number[]
  const rhrAvg7 = rhrValues.length > 0
    ? Math.round(rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length)
    : null

  // Whoop Score Trend (7 Tage)
  const whoopValues = last7.map(w => w.whoop_recovery_score).filter(v => v !== null) as number[]
  const whoopAvg7 = whoopValues.length > 0
    ? Math.round(whoopValues.reduce((a, b) => a + b, 0) / whoopValues.length)
    : null

  return NextResponse.json({
    today: todayEntry,
    trend: last7,
    baselines: {
      hrv_baseline_30d: hrvBaseline,
      rhr_avg_7d: rhrAvg7,
      whoop_avg_7d: whoopAvg7,
    },
  })
}

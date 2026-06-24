import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

function avg(arr: number[]): number | null {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params
  const weeks = parseInt(req.nextUrl.searchParams.get('weeks') ?? '12')

  const { data: person } = await supabaseAdmin
    .from('persons')
    .select('data_source, ftp_w, lthr_run, lthr_bike, hf_max')
    .eq('id', personId)
    .maybeSingle()

  const dataSource = (person?.data_source as string | null) ?? 'garmin'

  const from = new Date()
  from.setDate(from.getDate() - weeks * 7)
  const fromStr = from.toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  // ── TP-Athleten (Markus) ────────────────────────────────
  if (dataSource === 'tp') {
    const [{ data: acts }, { data: sessions }] = await Promise.all([
      supabaseAdmin
        .from('tp_activities')
        .select('workout_day, sport, tss_planned, tss_actual, hr_avg, if_actual, power_norm_w, rpe')
        .eq('person_id', personId)
        .eq('status', 'completed')
        .gte('workout_day', fromStr)
        .order('workout_day'),
      supabaseAdmin
        .from('training_plan_sessions')
        .select('date, completed_at, is_optional')
        .eq('user_id', personId)
        .eq('is_optional', false)
        .gte('date', fromStr)
        .lte('date', today),
    ])

    type TpWeek = {
      week: string; tss_plan: number; tss_ist: number
      run_hr: number[]; bike_np: number[]; bike_if: number[]; rpe: number[]
      planned: number; done: number
    }
    const wm: Record<string, TpWeek> = {}
    const init = (wk: string): TpWeek => ({
      week: wk, tss_plan: 0, tss_ist: 0,
      run_hr: [], bike_np: [], bike_if: [], rpe: [],
      planned: 0, done: 0,
    })

    for (const a of acts ?? []) {
      const wk = weekStart(String(a.workout_day))
      if (!wm[wk]) wm[wk] = init(wk)
      wm[wk].tss_plan += (a.tss_planned as number) ?? 0
      wm[wk].tss_ist  += (a.tss_actual as number) ?? 0
      if (a.hr_avg && a.sport === 'Run') wm[wk].run_hr.push(a.hr_avg as number)
      if (a.power_norm_w && a.sport === 'Bike') wm[wk].bike_np.push(a.power_norm_w as number)
      if (a.if_actual && a.sport === 'Bike') wm[wk].bike_if.push(a.if_actual as number)
      if (a.rpe) wm[wk].rpe.push(a.rpe as number)
    }

    for (const s of sessions ?? []) {
      const wk = weekStart(String(s.date))
      if (!wm[wk]) wm[wk] = init(wk)
      wm[wk].planned++
      if (s.completed_at) wm[wk].done++
    }

    const weeklyData = Object.values(wm)
      .sort((a, b) => a.week.localeCompare(b.week))
      .map(w => ({
        week: w.week,
        tss_plan: Math.round(w.tss_plan),
        tss_ist: Math.round(w.tss_ist),
        run_hr_avg: avg(w.run_hr),
        bike_np_avg: avg(w.bike_np),
        bike_if_avg: w.bike_if.length
          ? Math.round(w.bike_if.reduce((a, b) => a + b, 0) / w.bike_if.length * 100) / 100
          : null,
        rpe_avg: w.rpe.length
          ? Math.round(w.rpe.reduce((a, b) => a + b, 0) / w.rpe.length * 10) / 10
          : null,
        planned: w.planned,
        done: w.done,
        compliance: w.planned > 0 ? Math.round(w.done / w.planned * 100) : null,
      }))

    return NextResponse.json({
      dataSource: 'tp', weeks: weeklyData,
      person: { ftp_w: person?.ftp_w, lthr_run: person?.lthr_run, lthr_bike: person?.lthr_bike },
    })
  }

  // ── Garmin-Athleten (Ute, Christoph) ───────────────────
  const [{ data: acts }, { data: training }, { data: sessions }] = await Promise.all([
    supabaseAdmin
      .from('garmin_activities')
      .select('date, type, duration_min, avg_hr, norm_power')
      .eq('user_id', personId)
      .in('type', ['running', 'trail_running', 'cycling', 'indoor_cycling', 'road_biking', 'open_water_swimming', 'lap_swimming'])
      .gte('date', fromStr)
      .order('date'),
    supabaseAdmin
      .from('garmin_training')
      .select('date, ctl, atl, acwr, vo2max')
      .eq('user_id', personId)
      .gte('date', fromStr)
      .order('date'),
    supabaseAdmin
      .from('training_plan_sessions')
      .select('date, completed_at, is_optional')
      .eq('user_id', personId)
      .eq('is_optional', false)
      .gte('date', fromStr)
      .lte('date', today),
  ])

  type GarminWeek = {
    week: string; acts: number; total_min: number
    run_hr: number[]; bike_np: number[]; bike_hr: number[]
    planned: number; done: number
  }
  const wm2: Record<string, GarminWeek> = {}
  const init2 = (wk: string): GarminWeek => ({
    week: wk, acts: 0, total_min: 0,
    run_hr: [], bike_np: [], bike_hr: [],
    planned: 0, done: 0,
  })

  for (const a of acts ?? []) {
    const wk = weekStart(String(a.date))
    if (!wm2[wk]) wm2[wk] = init2(wk)
    const w = wm2[wk]
    w.acts++
    w.total_min += (a.duration_min as number) ?? 0
    const isRun  = ['running', 'trail_running'].includes(a.type as string)
    const isBike = ['cycling', 'indoor_cycling', 'road_biking'].includes(a.type as string)
    if (isRun && a.avg_hr)   w.run_hr.push(a.avg_hr as number)
    if (isBike && a.norm_power) w.bike_np.push(a.norm_power as number)
    if (isBike && a.avg_hr)  w.bike_hr.push(a.avg_hr as number)
  }

  for (const s of sessions ?? []) {
    const wk = weekStart(String(s.date))
    if (!wm2[wk]) wm2[wk] = init2(wk)
    wm2[wk].planned++
    if (s.completed_at) wm2[wk].done++
  }

  // letzter bekannter CTL/VO2max pro Woche
  const trByWeek: Record<string, { ctl: number | null; vo2max: number | null }> = {}
  for (const t of training ?? []) {
    const wk = weekStart(String(t.date))
    trByWeek[wk] = { ctl: t.ctl ? Math.round(t.ctl as number) : null, vo2max: t.vo2max as number | null }
  }

  const weeklyData = Object.values(wm2)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({
      week: w.week,
      activities: w.acts,
      total_min: w.total_min,
      run_hr_avg: avg(w.run_hr),
      bike_np_avg: avg(w.bike_np),
      bike_hr_avg: avg(w.bike_hr),
      ctl: trByWeek[w.week]?.ctl ?? null,
      vo2max: trByWeek[w.week]?.vo2max ?? null,
      planned: w.planned,
      done: w.done,
      compliance: w.planned > 0 ? Math.round(w.done / w.planned * 100) : null,
    }))

  return NextResponse.json({
    dataSource: 'garmin', weeks: weeklyData,
    person: { ftp_w: person?.ftp_w, lthr_run: person?.lthr_run, lthr_bike: person?.lthr_bike },
  })
}

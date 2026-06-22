import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params

  const from = new Date()
  from.setDate(from.getDate() - 14)
  const fromStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(from)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())

  const { data, error } = await supabaseAdmin
    .from('tp_activities')
    .select('id, workout_day, sport, title, duration_actual_h, distance_actual_km, tss_actual, hr_avg, hr_max, calories, status, if_actual, elevation_gain_m')
    .eq('person_id', personId)
    .eq('status', 'completed')
    .gte('workout_day', fromStr)
    .lte('workout_day', today)
    .order('workout_day', { ascending: false })
    .order('id', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Gruppieren nach Tag
  const byDay: Record<string, typeof data> = {}
  for (const act of data ?? []) {
    const d = String(act.workout_day)
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(act)
  }

  const days = Object.entries(byDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7) // max 7 Tage

  return NextResponse.json({ days })
}

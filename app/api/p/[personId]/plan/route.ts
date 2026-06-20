import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const SPORT_GARMIN: Record<string, string[]> = {
  running:  ['running', 'trail_running'],
  cycling:  ['cycling', 'indoor_cycling', 'road_biking', 'e_bike_fitness'],
  swimming: ['lap_swimming', 'open_water_swimming'],
}

function berlinToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params
  const mode = req.nextUrl.searchParams.get('mode') ?? 'upcoming'
  const today = berlinToday()

  let sessions
  if (mode === 'done') {
    const from = new Date(today + 'T12:00:00Z')
    from.setUTCDate(from.getUTCDate() - 60)
    const { data, error } = await supabaseAdmin
      .from('training_plan_sessions')
      .select('*')
      .eq('user_id', personId)
      .gte('date', from.toISOString().split('T')[0])
      .lt('date', today)
      .order('date', { ascending: false })
      .order('sort_order', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    sessions = data ?? []
  } else {
    const toDate = new Date(today + 'T12:00:00Z')
    toDate.setUTCDate(toDate.getUTCDate() + 90)
    const { data, error } = await supabaseAdmin
      .from('training_plan_sessions')
      .select('*')
      .eq('user_id', personId)
      .gte('date', today)
      .lte('date', toDate.toISOString().split('T')[0])
      .order('date', { ascending: true })
      .order('sort_order', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    sessions = data ?? []
  }

  // Garmin-Aktivitäten für Auto-Done
  const dates = [...new Set(sessions.map((s: { date: string }) => s.date))]
  const garminByDate: Record<string, string[]> = {}
  if (dates.length > 0) {
    const { data: acts } = await supabaseAdmin
      .from('garmin_activities')
      .select('date, type')
      .eq('user_id', personId)
      .in('date', dates)
    for (const a of acts ?? []) {
      if (!garminByDate[a.date]) garminByDate[a.date] = []
      garminByDate[a.date].push(a.type)
    }
  }

  const enriched = sessions.map((s: Record<string, unknown>) => ({
    ...s,
    garmin_done: (garminByDate[s.date as string] ?? []).some(t => (SPORT_GARMIN[s.sport as string] ?? []).includes(t)),
  }))

  return NextResponse.json({ sessions: enriched, personId })
}

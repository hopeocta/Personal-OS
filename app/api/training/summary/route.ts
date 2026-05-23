import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('garmin_activities')
    .select('*')
    .gte('date', cutoffStr)
    .order('date', { ascending: false })

  if (error) {
    console.error('[training/summary] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let swimKm = 0
  let bikeKm = 0
  let runKm = 0
  let totalMin = 0

  for (const a of data ?? []) {
    totalMin += a.duration_min ?? 0
    const t = (a.type ?? '').toLowerCase()
    const km = a.distance_km ?? 0
    if (t.includes('swim')) swimKm += km
    else if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) bikeKm += km
    else if (t.includes('run')) runKm += km
  }

  return NextResponse.json({
    swimKm: Math.round(swimKm * 10) / 10,
    bikeKm: Math.round(bikeKm * 10) / 10,
    runKm: Math.round(runKm * 10) / 10,
    totalHours: Math.round((totalMin / 60) * 10) / 10,
    activities: data,
  })
}

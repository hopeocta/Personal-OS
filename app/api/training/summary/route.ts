import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const [actRes, raceRes] = await Promise.all([
    supabaseAdmin.from('garmin_activities').select('*').eq('user_id', 'me').gte('date', cutoffStr).not('type', 'in', '("walking","uncategorized_activity","generic")').order('date', { ascending: false }),
    supabaseAdmin.from('triathlon_races').select('date,swim_distance_km,bike_distance_km,run_distance_km').eq('user_id', 'me').gte('date', cutoffStr),
  ])

  if (actRes.error) {
    console.error('[training/summary] error:', actRes.error)
    return NextResponse.json({ error: actRes.error.message }, { status: 500 })
  }

  // Datum → Triathlon-Splits, für multi_sport-Auflösung
  const raceByDate = new Map<string, { swim: number; bike: number; run: number }>()
  for (const r of raceRes.data ?? []) {
    raceByDate.set(String(r.date), {
      swim: Number(r.swim_distance_km ?? 0),
      bike: Number(r.bike_distance_km ?? 0),
      run: Number(r.run_distance_km ?? 0),
    })
  }

  let swimKm = 0
  let bikeKm = 0
  let runKm = 0
  let totalMin = 0

  for (const a of actRes.data ?? []) {
    totalMin += a.duration_min ?? 0
    const t = (a.type ?? '').toLowerCase()
    const km = Number(a.distance_km ?? 0)

    if (t.includes('multi') || t === 'multi_sport') {
      // Splits aus triathlon_races, falls vorhanden — sonst Gesamtdistanz als Brick ignorieren
      const splits = raceByDate.get(String(a.date))
      if (splits) {
        swimKm += splits.swim
        bikeKm += splits.bike
        runKm  += splits.run
      }
      // Keine km zählen wenn keine Splits bekannt (vermeidet Doppelzählung)
    } else if (t.includes('swim')) {
      swimKm += km
    } else if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) {
      bikeKm += km
    } else if (t.includes('run')) {
      runKm += km
    }
  }

  return NextResponse.json({
    swimKm: Math.round(swimKm * 10) / 10,
    bikeKm: Math.round(bikeKm * 10) / 10,
    runKm: Math.round(runKm * 10) / 10,
    totalHours: Math.round((totalMin / 60) * 10) / 10,
    activities: actRes.data,
  })
}

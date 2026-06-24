import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

const SPORT_DE: Record<string, string> = {
  running: 'Laufen', cycling: 'Rad', swimming: 'Schwimmen',
  Bike: 'Rad', Run: 'Laufen', Swim: 'Schwimmen',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId fehlt' }, { status: 400 })

  const [{ data: session }, { data: person }] = await Promise.all([
    supabaseAdmin.from('training_plan_sessions')
      .select('date, sport, title, duration_min, hf_zone, hf_range, details, intensity_kind, completed_at')
      .eq('id', sessionId).eq('user_id', personId).maybeSingle(),
    supabaseAdmin.from('persons')
      .select('display_name, data_source, lthr_run, lthr_bike, ftp_w, hf_max, hr_zones')
      .eq('id', personId).maybeSingle(),
  ])

  if (!session) return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 })

  const dataSource = (person?.data_source as string | null) ?? 'garmin'
  const sessionDate = String(session.date)

  // Ist-Daten holen
  let actualHr: number | null = null
  let actualMin: number | null = null
  let actualTss: number | null = null
  let actualDistKm: number | null = null

  if (dataSource === 'tp') {
    const TP_SPORT: Record<string, string[]> = {
      running: ['Run'], cycling: ['Bike'], swimming: ['Swim'],
    }
    const tpSports = TP_SPORT[session.sport as string] ?? []
    const { data: tpAct } = await supabaseAdmin
      .from('tp_activities')
      .select('hr_avg, duration_actual_h, tss_actual, distance_actual_km')
      .eq('person_id', personId).eq('workout_day', sessionDate)
      .in('sport', tpSports).eq('status', 'completed').maybeSingle()
    if (tpAct) {
      actualHr = tpAct.hr_avg as number | null
      actualMin = tpAct.duration_actual_h ? Math.round((tpAct.duration_actual_h as number) * 60) : null
      actualTss = tpAct.tss_actual as number | null
      actualDistKm = tpAct.distance_actual_km as number | null
    }
  } else {
    const GARMIN_SPORT: Record<string, string[]> = {
      running: ['running', 'trail_running'],
      cycling: ['cycling', 'indoor_cycling', 'road_biking'],
      swimming: ['lap_swimming', 'open_water_swimming'],
    }
    const types = GARMIN_SPORT[session.sport as string] ?? []
    const { data: gAct } = await supabaseAdmin
      .from('garmin_activities')
      .select('avg_hr, duration_min, distance_km')
      .eq('user_id', personId).eq('date', sessionDate)
      .in('type', types).maybeSingle()
    if (gAct) {
      actualHr = gAct.avg_hr as number | null
      actualMin = gAct.duration_min as number | null
      actualDistKm = gAct.distance_km as number | null
    }
  }

  const sportLabel = SPORT_DE[session.sport as string] ?? String(session.sport)
  const plannedMin = session.duration_min as number
  const hfZone = session.hf_zone as string | null
  const hfRange = session.hf_range as string | null
  const personName = (person?.display_name as string | null) ?? 'Athlet'

  // Prompt: kurz, präzise, auf Deutsch
  const context = [
    `Athlet: ${personName}`,
    `Einheit: ${session.title ?? sportLabel} (${sportLabel})`,
    `Plan: ${plannedMin} min${hfZone ? `, Zone ${hfZone}` : ''}${hfRange ? `, HF ${hfRange} bpm` : ''}`,
    actualMin ? `Ist: ${actualMin} min` : null,
    actualHr ? `Ø HF: ${actualHr} bpm` : null,
    actualTss ? `TSS: ${Math.round(actualTss)}` : null,
    actualDistKm ? `Distanz: ${actualDistKm.toFixed(1)} km` : null,
    person?.lthr_run ? `LTHR Laufen: ${person.lthr_run} bpm` : null,
    person?.lthr_bike ? `LTHR Rad: ${person.lthr_bike} bpm` : null,
    person?.ftp_w ? `FTP: ${person.ftp_w}W` : null,
  ].filter(Boolean).join('\n')

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    messages: [{
      role: 'user',
      content: `Du bist ein freundlicher Triathlon-Coach. Gib kurzes, konkretes Feedback auf Deutsch (2-3 Sätze max): erst was gut lief, dann einen spezifischen Tipp für die nächste ähnliche Einheit. Kein Smalltalk, kein "Hallo". Direkt loslegen.\n\n${context}`,
    }],
  })

  const feedback = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '—'
  return NextResponse.json({ feedback })
}

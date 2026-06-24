import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

const SPORT_DE: Record<string, string> = {
  running: 'Laufen', trail_running: 'Trail-Lauf', cycling: 'Radfahren',
  indoor_cycling: 'Indoor Rad', virtual_ride: 'Indoor Rad',
  lap_swimming: 'Schwimmen', open_water_swimming: 'Freiwasser-Schwimmen',
  strength_training: 'Krafttraining', multi_sport: 'Triathlon',
}

const SPORT_PLAN: Record<string, string[]> = {
  running: ['running'], trail_running: ['running'],
  cycling: ['cycling'], indoor_cycling: ['cycling'], virtual_ride: ['cycling'],
  lap_swimming: ['swimming'], open_water_swimming: ['swimming'],
  strength_training: ['strength'],
}

export async function GET(req: NextRequest) {
  const activityId = req.nextUrl.searchParams.get('activityId')
  if (!activityId) return NextResponse.json({ error: 'activityId fehlt' }, { status: 400 })

  const [{ data: act }, { data: person }] = await Promise.all([
    supabaseAdmin.from('garmin_activities')
      .select('date, type, name, duration_min, avg_hr, max_hr, distance_km, avg_pace, avg_power, norm_power, elevation_m, calories')
      .eq('user_id', 'me')
      .eq('activity_id', activityId)
      .maybeSingle(),
    supabaseAdmin.from('persons')
      .select('lthr_run, lthr_bike, ftp_w, hf_max, hr_zones')
      .eq('id', 'me')
      .maybeSingle(),
  ])

  if (!act) return NextResponse.json({ error: 'Aktivität nicht gefunden' }, { status: 404 })

  // Passende Plan-Session suchen (optional — für Ist-vs-Plan-Vergleich)
  const planSports = SPORT_PLAN[act.type as string] ?? []
  const { data: plan } = planSports.length
    ? await supabaseAdmin.from('training_plan_sessions')
        .select('title, duration_min, hf_zone, hf_range, details, intensity_kind')
        .eq('user_id', 'me')
        .eq('date', String(act.date))
        .in('sport', planSports)
        .maybeSingle()
    : { data: null }

  const sportLabel = SPORT_DE[act.type as string] ?? String(act.type).replace(/_/g, ' ')

  const lines: string[] = [
    `Sport: ${sportLabel}`,
    act.duration_min ? `Dauer: ${act.duration_min} min` : '',
    act.avg_hr ? `Ø HF: ${act.avg_hr} bpm` : '',
    act.max_hr ? `Max HF: ${act.max_hr} bpm` : '',
    act.distance_km ? `Distanz: ${(act.distance_km as number).toFixed(1)} km` : '',
    act.avg_pace ? `Ø Tempo: ${act.avg_pace}` : '',
    act.norm_power ? `NP: ${act.norm_power} W` : '',
    act.avg_power ? `Ø Watt: ${act.avg_power} W` : '',
    act.elevation_m ? `Höhenmeter: +${act.elevation_m} m` : '',
    person?.lthr_run ? `LTHR Laufen: ${person.lthr_run} bpm` : '',
    person?.lthr_bike ? `LTHR Rad: ${person.lthr_bike} bpm` : '',
    person?.ftp_w ? `FTP: ${person.ftp_w} W` : '',
  ].filter(Boolean)

  if (plan) {
    lines.push('--- Plan ---')
    lines.push(`Plan: ${plan.title ?? sportLabel}, ${plan.duration_min} min`)
    if (plan.hf_zone) lines.push(`Zone: ${plan.hf_zone}`)
    if (plan.hf_range) lines.push(`HF-Ziel: ${plan.hf_range} bpm`)
  }

  const context = lines.join('\n')

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Du bist ein knapper, freundlicher Triathlon-Coach. Gib Feedback auf Deutsch in 2-3 kurzen Sätzen: erst was gut lief, dann einen konkreten Tipp für die nächste ähnliche Einheit. Kein Smalltalk, direkt loslegen.\n\n${context}`,
    }],
  })

  const feedback = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '—'
  return NextResponse.json({ feedback })
}

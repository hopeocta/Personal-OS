import { NextRequest, NextResponse } from 'next/server'
import type { CalendarEvent, TrainingPlanSession } from '@/lib/types'
import { fetchCalendarEvents } from '@/lib/calendar'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

// YYYY-MM-DD "heute" in Berliner Zeit (kein Server-UTC-Offset an der Tagesgrenze).
function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}

// UTC-Instant für 00:00 Uhr Berliner Zeit "heute" — DST-sicher (kein fester Offset).
// Wird statt `new Date()` als rangeStart genutzt: sonst fällt ein ganztägiges
// Event von heute (Mitternacht-Anker) raus, sobald die Uhrzeit den Anker überschreitet
// (z. B. Runna-Lauf verschwindet ab Mittag aus "Nächste Trainings").
function berlinDayStart(todayStr: string): Date {
  const utcMidnight = new Date(`${todayStr}T00:00:00Z`)
  const berlinHourAtUtcMidnight = parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false }).format(utcMidnight),
    10
  )
  // Berlin-Offset zu UTC-Mitternacht ist genau diese Stunde (1 = CET, 2 = CEST).
  const berlinMidnightUtc = new Date(utcMidnight)
  berlinMidnightUtc.setUTCHours(berlinMidnightUtc.getUTCHours() - berlinHourAtUtcMidnight)
  return berlinMidnightUtc
}

const SPORT_ICON: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', strength: '🏋', brick: '⚡',
}

// Geplante Trainingseinheiten als ganztägige Kalender-Events.
// Läufe NICHT (kommen via Garmin-iCal, da Runna sie an Garmin sendet) und keine Ruhetage
// → nur Rad/Schwimmen/Kraft, die Garmin nicht kennt. Verhindert Doppel-Einträge.
async function fetchTrainingEvents(fromStr: string, toStr: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabaseAdmin
    .from('training_plan_sessions')
    .select('*')
    .eq('user_id', 'me')
    .not('sport', 'in', '(rest,run)')
    .gte('date', fromStr)
    .lte('date', toStr)
    .order('date', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('[calendar] training fetch error:', error)
    return []
  }
  return (data as TrainingPlanSession[]).map((s) => {
    const metric = [
      s.distance_km != null ? `${s.distance_km} km` : null,
      s.duration_min != null ? `${s.duration_min} min` : null,
    ].filter(Boolean).join(' · ')
    const desc = [
      s.hf_zone ? `Zone ${s.hf_zone}${s.hf_range ? ` (${s.hf_range})` : ''}` : null,
      s.watts_indoor ? `Indoor ${s.watts_indoor}` : null,
      s.details,
    ].filter(Boolean).join(' — ')
    return {
      id: `train-${s.id}`,
      title: `${SPORT_ICON[s.sport] ?? '•'} ${s.title}${metric ? ` · ${metric}` : ''}`,
      start: `${s.date}T00:00:00`,
      end: `${s.date}T23:59:59`,
      allDay: true,
      description: desc || null,
      location: null,
      source: 'training',
      sport: s.sport,
    }
  })
}

const cacheMap = new Map<string, { events: CalendarEvent[]; fetchedAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const fromParam = sp.get('from')
  const toParam = sp.get('to')

  // Range mode: explicit from/to (YYYY-MM-DD) — includes past events.
  // Default mode: future-only window of N days from now (used by the home card).
  let rangeStart: Date
  let rangeEnd: Date
  let cacheKey: string
  let fromStrOverride: string | null = null

  if (fromParam && toParam) {
    rangeStart = new Date(`${fromParam}T00:00:00.000Z`)
    rangeEnd = new Date(`${toParam}T23:59:59.999Z`)
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return NextResponse.json(
        { error: 'Invalid from/to — expected YYYY-MM-DD' },
        { status: 400 }
      )
    }
    cacheKey = `range:${fromParam}|${toParam}`
  } else {
    const daysParam = sp.get('days')
    const windowDays = daysParam ? Math.min(parseInt(daysParam), 365) : 14
    const todayStr = berlinToday()
    rangeStart = berlinDayStart(todayStr)
    rangeEnd = new Date()
    rangeEnd.setDate(rangeEnd.getDate() + windowDays)
    cacheKey = `days:${windowDays}`
    // rangeStart liegt (DST-abhängig) auf dem Vortag in UTC — für den
    // training_plan_sessions-Datumsabgleich zählt aber das echte Berlin-Datum.
    fromStrOverride = todayStr
  }

  const cached = cacheMap.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cached.events, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  let events: CalendarEvent[]
  try {
    events = await fetchCalendarEvents(rangeStart, rangeEnd)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Calendar fetch/parse error:', msg)
    return NextResponse.json({ error: `Calendar error: ${msg}` }, { status: 502 })
  }

  // Geplante Trainings einmischen (Fehler dort dürfen den Kalender nicht killen).
  const fromStr = fromStrOverride ?? rangeStart.toISOString().slice(0, 10)
  const toStr = rangeEnd.toISOString().slice(0, 10)
  const trainingEvents = await fetchTrainingEvents(fromStr, toStr)
  events = [...events, ...trainingEvents].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  )

  cacheMap.set(cacheKey, { events, fetchedAt: Date.now() })

  return NextResponse.json(events, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { fetchCalendarEvents } from '@/lib/calendar'
import { isCalendarRunEvent } from '@/lib/trainingCalendar'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}

function localDateFromIso(iso: string): string {
  // Ganztags-Events: UTC-Mitternacht → lokales Datum
  return new Date(iso).toLocaleDateString('en-CA')
}

function parseDistance(title: string): number | null {
  const m = title.match(/\((\d+[,.]\d*|\d+)\s*km\)/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

function parseDuration(start: string, end: string, allDay: boolean): number | null {
  if (allDay) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return ms > 0 && ms < 8 * 3600000 ? Math.round(ms / 60000) : null
}

export async function POST(req: NextRequest) {
  // Öffentlicher Aufruf vom Dashboard-Button erlaubt (kein sensibler Write — nur eigene iCal).
  // Cron-Aufruf via Vercel sendet Bearer-Header, wird ebenfalls akzeptiert.
  // Schutz gegen Spam: Rate-Limit nicht nötig da nur eigene Daten geschrieben werden.
  void req // unused but typed for Next.js

  const today = berlinToday()
  const rangeStart = new Date(today + 'T00:00:00Z')
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeEnd.getDate() + 60)

  // Beide Kalender-Quellen (Google Calendar + Garmin iCal) — genau wie /api/calendar
  let events
  try {
    events = await fetchCalendarEvents(rangeStart, rangeEnd)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `iCal fetch failed: ${msg}` }, { status: 502 })
  }

  const runEvents = events.filter((e) => isCalendarRunEvent(e.title))

  // Alle zukünftigen Runna-Runs aus DB löschen (werden frisch geschrieben)
  const { error: delErr } = await supabaseAdmin
    .from('training_plan_sessions')
    .delete()
    .eq('user_id', 'me')
    .eq('sport', 'run')
    .eq('source', 'runna')
    .gte('date', today)

  if (delErr) {
    console.error('[sync-runna] delete error:', delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (runEvents.length === 0) {
    return NextResponse.json({ inserted: 0 })
  }

  const rows = runEvents.map((e) => {
    const date = localDateFromIso(e.start)
    const distance_km = parseDistance(e.title)
    const duration_min = parseDuration(e.start, e.end, e.allDay ?? false)
    return {
      user_id: 'me',
      date,
      sport: 'run',
      source: 'runna',
      title: e.title,
      distance_km: distance_km ?? null,
      duration_min: duration_min ?? null,
      is_optional: false,
      is_event: false,
      sort_order: 0,
    }
  })

  const { error: insErr } = await supabaseAdmin
    .from('training_plan_sessions')
    .insert(rows)

  if (insErr) {
    console.error('[sync-runna] insert error:', insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ inserted: rows.length })
}

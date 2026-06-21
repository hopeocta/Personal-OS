import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchFromIcalUrl } from '@/lib/calendar'
import type { CalendarEvent } from '@/lib/types'

export const runtime = 'nodejs'

const SPORT_GARMIN: Record<string, string[]> = {
  running:  ['running', 'trail_running'],
  cycling:  ['cycling', 'indoor_cycling', 'road_biking', 'e_bike_fitness'],
  swimming: ['lap_swimming', 'open_water_swimming'],
}

function berlinToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}
// Datum eines (ganztägigen) iCal-Events in Berliner Zeit — Garmin verankert
// All-Day-Events auf UTC-Mitternacht, serverseitiges toISOString würde verschieben.
function berlinDateOf(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(iso))
}

// Erkennt Lauf-Events im iCal (Runna pusht geplante Läufe in den Garmin-Kalender).
function isRunTitle(title: string): boolean {
  const t = title.toLowerCase()
  const nonRun = ['schwimm', 'swim', 'rad', 'bike', 'cycl', 'velo', 'kraft', 'gym', 'strength', 'yoga']
  if (nonRun.some((kw) => t.includes(kw))) return false
  return ['run', 'lauf', 'jog', 'marathon', 'pace', 'intervall', 'interval', 'tempo', 'easy', 'recovery', 'long run', 'runna', 'km'].some((kw) => t.includes(kw))
}
function parseRunDistance(title: string): number | null {
  const m = title.match(/(\d+(?:[.,]\d+)?)\s*km/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

// ── iCal-Cache (5 min) ────────────────────────────────────
type RunHit = { id: string; date: string; title: string; details: string | null; duration_min: number | null }
const icalCache = new Map<string, { runs: RunHit[]; at: number }>()
const ICAL_TTL = 5 * 60 * 1000

async function fetchRunnaRuns(url: string, fromStr: string, toStr: string): Promise<RunHit[]> {
  const key = `${url}|${fromStr}|${toStr}`
  const cached = icalCache.get(key)
  if (cached && Date.now() - cached.at < ICAL_TTL) return cached.runs
  try {
    const rangeStart = new Date(`${fromStr}T00:00:00Z`)
    const rangeEnd = new Date(`${toStr}T23:59:59Z`)
    const events: CalendarEvent[] = await fetchFromIcalUrl(url, rangeStart, rangeEnd, 'runna-')
    const runs: RunHit[] = events
      .filter((e) => isRunTitle(e.title))
      .map((e) => {
        const durMs = new Date(e.end).getTime() - new Date(e.start).getTime()
        const duration_min = !e.allDay && durMs > 0 && durMs < 8 * 3600000 ? Math.round(durMs / 60000) : null
        return { id: e.id, date: berlinDateOf(e.start), title: e.title, details: e.description ?? null, duration_min }
      })
    icalCache.set(key, { runs, at: Date.now() })
    return runs
  } catch (err) {
    console.error('[p/plan] Runna-iCal-Fehler:', err)
    return [] // fehlersicher: keine Läufe → Plan-Läufe bleiben sichtbar
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params
  const mode = req.nextUrl.searchParams.get('mode') ?? 'upcoming'
  const today = berlinToday()

  let sessions: Record<string, unknown>[]
  let toStr = today
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
    toStr = toDate.toISOString().split('T')[0]
    const { data, error } = await supabaseAdmin
      .from('training_plan_sessions')
      .select('*')
      .eq('user_id', personId)
      .gte('date', today)
      .lte('date', toStr)
      .order('date', { ascending: true })
      .order('sort_order', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    sessions = data ?? []
  }

  // ── Runna-Läufe einmischen (nur upcoming, nur wenn Person eine iCal-URL hat) ──
  if (mode !== 'done') {
    const { data: person } = await supabaseAdmin
      .from('persons')
      .select('garmin_ical_url')
      .eq('id', personId)
      .maybeSingle()
    const icalUrl = person?.garmin_ical_url as string | undefined
    if (icalUrl) {
      const runs = await fetchRunnaRuns(icalUrl, today, toStr)
      if (runs.length > 0) {
        // Wettkampf-Tage (is_event) behalten Vorrang vor Runna
        const eventRunDates = new Set(
          sessions.filter((s) => s.sport === 'running' && s.is_event).map((s) => s.date as string)
        )
        // Plan-Läufe ersetzen: feste Haupt-Läufe raus (Runna übernimmt sie).
        // Event-Läufe (Wettkampf) UND optionale Plan-Läufe bleiben erhalten.
        sessions = sessions.filter((s) => !(s.sport === 'running' && !s.is_event && !s.is_optional))
        // Runna-Läufe als gesperrte Einheiten ergänzen (außer an Wettkampf-Tagen)
        for (const r of runs) {
          if (eventRunDates.has(r.date)) continue
          sessions.push({
            id: r.id, user_id: personId, date: r.date, sport: 'running',
            title: r.title, duration_min: r.duration_min,
            distance_km: parseRunDistance(r.title),
            hf_zone: null, hf_range: null, details: r.details,
            is_optional: false, is_event: false, outdoor_alt: null,
            intensity_kind: null, completed_at: null, sort_order: 5,
            source: 'runna', locked: true,
          })
        }
        sessions.sort((a, b) => {
          const d = String(a.date).localeCompare(String(b.date))
          return d !== 0 ? d : (Number(a.sort_order) - Number(b.sort_order))
        })
      }
    }
  }

  // ── Garmin-Aktivitäten für Auto-Done ──────────────────────
  const dates = [...new Set(sessions.map((s) => s.date as string))]
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

  const enriched = sessions.map((s) => ({
    ...s,
    garmin_done: (garminByDate[s.date as string] ?? []).some((t) => (SPORT_GARMIN[s.sport as string] ?? []).includes(t)),
  }))

  return NextResponse.json({ sessions: enriched, personId })
}

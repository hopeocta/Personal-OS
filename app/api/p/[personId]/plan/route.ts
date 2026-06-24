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

  // ── Runna-Läufe einmischen + Krank-Ramp (nur upcoming) ──
  let sickSince: string | null = null
  if (mode !== 'done') {
    const { data: person } = await supabaseAdmin
      .from('persons')
      .select('garmin_ical_url, sick_since')
      .eq('id', personId)
      .maybeSingle()
    sickSince = (person?.sick_since as string | null) ?? null
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

    // Krank-Ramp: die ersten 3 Trainingstage ab Wiedereinstieg reduziert hochfahren
    if (sickSince) {
      const start = sickSince > today ? sickSince : today
      const rampDates = [...new Set(
        sessions.filter((s) => (s.date as string) >= start).map((s) => s.date as string)
      )].sort().slice(0, 3)
      const FACTORS = [0.6, 0.75, 0.9]
      sessions = sessions.map((s) => {
        const idx = rampDates.indexOf(s.date as string)
        if (idx === -1) return s
        const f = FACTORS[idx]
        const dur = typeof s.duration_min === 'number' ? s.duration_min : null
        const locked = s.locked === true
        return {
          ...s,
          // Plan-Einheiten kürzen + locker deckeln; Runna-Läufe nur mit Hinweis (nicht änderbar)
          duration_min: locked || dur == null ? dur : Math.round(dur * f),
          hf_zone: locked ? s.hf_zone : (idx < 2 ? 'Z1' : 'Z1-Z2'),
          ramp_factor: f,
          ramp_note: `Wiedereinstieg nach Krankheit — Tag ${idx + 1}/3 (${Math.round(f * 100)}%)${locked ? ' · Runna locker & kürzer angehen' : ''}`,
        }
      })
    }
  }

  // ── Datenquelle der Person ermitteln ───────────────────────
  const { data: personMeta } = await supabaseAdmin
    .from('persons')
    .select('data_source')
    .eq('id', personId)
    .maybeSingle()
  const dataSource = (personMeta?.data_source as string | null) ?? 'garmin'

  const dates = [...new Set(sessions.map((s) => s.date as string))]
  const garminByDate: Record<string, string[]> = {}
  type ActualMetrics = { hr_avg: number | null; duration_min: number | null; tss: number | null; if_actual: number | null }
  const actualByKey: Record<string, ActualMetrics> = {}

  if (dates.length > 0) {
    if (dataSource === 'tp') {
      const TP_SPORT: Record<string, string> = {
        Run: 'running', Bike: 'cycling', Swim: 'swimming',
        Brick: 'running', Duathlon: 'running',
      }
      const { data: tpActs } = await supabaseAdmin
        .from('tp_activities')
        .select('workout_day, sport, hr_avg, duration_actual_h, tss_actual, if_actual')
        .eq('person_id', personId)
        .eq('status', 'completed')
        .in('workout_day', dates)
      for (const a of tpActs ?? []) {
        const d = String(a.workout_day)
        const mappedSport = TP_SPORT[a.sport as string] ?? String(a.sport)
        if (!garminByDate[d]) garminByDate[d] = []
        garminByDate[d].push(mappedSport)
        const key = `${d}|${mappedSport}`
        if (!actualByKey[key]) {
          actualByKey[key] = {
            hr_avg: (a.hr_avg as number | null) ?? null,
            duration_min: a.duration_actual_h ? Math.round((a.duration_actual_h as number) * 60) : null,
            tss: (a.tss_actual as number | null) ?? null,
            if_actual: (a.if_actual as number | null) ?? null,
          }
        }
      }
    } else {
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
  }

  const enriched = sessions.map((s) => {
    const garmin_done = (garminByDate[s.date as string] ?? []).some((t) => (SPORT_GARMIN[s.sport as string] ?? []).includes(t))
    const actual = garmin_done ? (actualByKey[`${String(s.date)}|${String(s.sport)}`] ?? null) : null
    return {
      ...s,
      garmin_done,
      actual_hr: actual?.hr_avg ?? null,
      actual_min: actual?.duration_min ?? null,
      actual_tss: actual?.tss ?? null,
      actual_if: actual?.if_actual ?? null,
    }
  })

  return NextResponse.json({ sessions: enriched, personId, sick_since: sickSince })
}

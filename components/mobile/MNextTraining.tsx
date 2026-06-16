'use client'

import { useEffect, useState, useCallback } from 'react'
import { MCard } from './MCard'
import type { TrainingPlanSession, CalendarEvent } from '@/lib/types'

const SPORT_COLOR: Record<string, string> = {
  swim: 'var(--sport-swim)',
  bike: 'var(--sport-bike)',
  run: 'var(--sport-run)',
  strength: 'var(--sport-strength)',
  brick: 'var(--accent)',
  rest: 'var(--sport-rest)',
}
const DAY = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']

function wd(d: string): string {
  return DAY[new Date(d + 'T12:00:00').getDay()]
}
function fmtDur(min: number | null): string {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}
function clean(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t && t !== '—' ? t : null
}
function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

// Erkennt Lauf-Events aus Kalender-Titeln (Runna/Garmin iCal)
function isRunEvent(title: string): boolean {
  const t = title.toLowerCase()
  const runKws = ['run', 'lauf', 'jog', 'marathon', 'pace', 'intervals', 'easy', 'tempo run', 'long run', 'recovery run']
  const nonRunKws = ['schwimm', 'swim', 'rad', 'bike', 'cycl', 'kraft', 'gym', 'strength']
  if (nonRunKws.some((kw) => t.includes(kw))) return false
  return runKws.some((kw) => t.includes(kw))
}

// Einheitliches Anzeigeformat für plan-sessions und Kalender-Läufe
type DisplaySession = {
  id: string
  date: string
  sport: string
  title: string
  duration_min: number | null
  distance_km: number | null
  details: string | null
  hf_zone: string | null
  hf_range: string | null
  pace_speed: string | null
  watts_indoor: string | null
  locked: boolean   // true = Runna/Kalender → kein Verschieben
}

function fromPlan(s: TrainingPlanSession): DisplaySession {
  return {
    id: s.id,
    date: s.date,
    sport: s.sport,
    title: s.title,
    duration_min: s.duration_min,
    distance_km: s.distance_km,
    details: s.details,
    hf_zone: s.hf_zone,
    hf_range: s.hf_range,
    pace_speed: s.pace_speed,
    watts_indoor: s.watts_indoor,
    locked: false,
  }
}

function fromCalendarRun(e: CalendarEvent): DisplaySession {
  const durationMs = new Date(e.end).getTime() - new Date(e.start).getTime()
  // allDay-Events (Garmin/Runna iCal) haben 24h-Dauer — nicht anzeigen
  const duration_min = !e.allDay && durationMs > 0 && durationMs < 8 * 3600000
    ? Math.round(durationMs / 60000)
    : null
  return {
    id: e.id,
    date: e.start.slice(0, 10),
    sport: 'run',
    title: e.title,
    duration_min,
    distance_km: null,
    details: e.description,
    hf_zone: null,
    hf_range: null,
    pace_speed: null,
    watts_indoor: null,
    locked: true,
  }
}

export function MNextTraining() {
  const [sessions, setSessions] = useState<DisplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [bikeMode, setBikeMode] = useState<Record<string, 'indoor' | 'outdoor'>>({})
  const [shifting, setShifting] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [planRes, calRes] = await Promise.all([
        fetch('/api/training/plan?days=14').then((r) => r.ok ? r.json() : { sessions: [] }),
        fetch('/api/calendar?days=14').then((r) => r.ok ? r.json() : []),
      ])

      const planSessions: DisplaySession[] = (Array.isArray(planRes?.sessions) ? planRes.sessions : [])
        .map((s: TrainingPlanSession) => fromPlan(s))

      const calendarEvents: CalendarEvent[] = Array.isArray(calRes) ? calRes : []
      const runEvents: DisplaySession[] = calendarEvents
        .filter((e) => e.source !== 'training' && isRunEvent(e.title))
        .map((e) => fromCalendarRun(e))

      // Duplikate nach Datum+Sport vermeiden (plan hätte theoretisch runs)
      const planIds = new Set(planSessions.map((s) => `${s.date}-${s.sport}`))
      const uniqueRuns = runEvents.filter((r) => !planIds.has(`${r.date}-run`))

      const merged = [...planSessions, ...uniqueRuns]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 10)

      setSessions(merged)
    } catch (e) {
      console.error('[m/next] fetch error:', e)
      setError('Plan konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const shiftDate = async (s: DisplaySession, delta: number) => {
    if (s.locked || shifting) return
    const newDate = addDays(s.date, delta)
    setShifting(s.id)
    try {
      const res = await fetch('/api/training/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, date: newDate }),
      })
      if (!res.ok) throw new Error('PATCH fehlgeschlagen')
      // Optimistisches Update: Datum im State aktualisieren und neu sortieren
      setSessions((prev) =>
        [...prev.map((x) => (x.id === s.id ? { ...x, date: newDate } : x))]
          .sort((a, b) => a.date.localeCompare(b.date))
      )
    } catch (e) {
      console.error('[m/next] shift error:', e)
    } finally {
      setShifting(null)
    }
  }

  const metricsFor = (s: DisplaySession, mode: 'indoor' | 'outdoor'): [string, string][] => {
    const rows: [string, string | null][] =
      s.sport === 'bike'
        ? mode === 'indoor'
          ? [
              ['Watt', clean(s.watts_indoor)],
              ['HF-Zone', clean(s.hf_zone)],
              ['HF-Bereich', clean(s.hf_range)],
              ['Dauer', fmtDur(s.duration_min) || null],
            ]
          : [
              ['HF-Zone', clean(s.hf_zone)],
              ['HF-Bereich', clean(s.hf_range)],
              ['Tempo', clean(s.pace_speed)],
              ['Dauer', fmtDur(s.duration_min) || null],
              ['Distanz', s.distance_km ? `${s.distance_km} km` : null],
            ]
        : [
            ['HF-Zone', clean(s.hf_zone)],
            ['HF-Bereich', clean(s.hf_range)],
            ['Tempo', clean(s.pace_speed)],
            ['Watt', clean(s.watts_indoor)],
            ['Dauer', fmtDur(s.duration_min) || null],
            ['Distanz', s.distance_km ? `${s.distance_km} km` : null],
          ]
    return rows.filter((r): r is [string, string] => r[1] != null)
  }

  return (
    <MCard label="Nächste Trainings">
      {loading && <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Lädt…</div>}
      {error && <div style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</div>}
      {!loading && !error && sessions.length === 0 && (
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Nichts geplant</div>
      )}

      {sessions.map((s, i) => {
        const isOpen = openId === s.id
        const mode = bikeMode[s.id] ?? 'outdoor'
        const metrics = metricsFor(s, mode)
        const isShifting = shifting === s.id
        return (
          <div key={s.id} style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--line)' : 'none' }}>
            {/* Touch-Target: größer als vorher (14px statt 10px, 0.9rem statt 0.82rem) */}
            <div
              onClick={() => setOpenId(isOpen ? null : s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', cursor: 'pointer', minHeight: 52 }}
            >
              <span style={{ minWidth: '2.8rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-3)', flexShrink: 0 }}>
                {wd(s.date)} {Number(s.date.slice(8, 10))}.
              </span>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: SPORT_COLOR[s.sport] || 'var(--ink-3)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, color: 'var(--ink-1)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.title}
              </span>
              {s.locked && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--ink-3)', letterSpacing: '0.06em', flexShrink: 0 }}>
                  RUNNA
                </span>
              )}
              {s.duration_min ? (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-3)', flexShrink: 0 }}>{fmtDur(s.duration_min)}</span>
              ) : null}
              <span style={{ color: 'var(--ink-3)', fontSize: '0.75rem', transition: 'transform .15s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                ▾
              </span>
            </div>

            {isOpen && (
              <div style={{ padding: '2px 0 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Verschieben (nur für plan-sessions, nicht Runna) */}
                {!s.locked && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => shiftDate(s, -1)}
                      disabled={!!isShifting}
                      style={{
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '6px 14px',
                        cursor: isShifting ? 'default' : 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        background: 'transparent',
                        color: 'var(--ink-2)',
                        opacity: isShifting ? 0.4 : 1,
                      }}
                    >
                      ← −1
                    </button>
                    <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-3)' }}>
                      {isShifting ? '…' : `${wd(s.date)}, ${Number(s.date.slice(8, 10))}. ${new Date(s.date + 'T12:00:00').toLocaleDateString('de-DE', { month: 'short' })}`}
                    </span>
                    <button
                      onClick={() => shiftDate(s, 1)}
                      disabled={!!isShifting}
                      style={{
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '6px 14px',
                        cursor: isShifting ? 'default' : 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        background: 'transparent',
                        color: 'var(--ink-2)',
                        opacity: isShifting ? 0.4 : 1,
                      }}
                    >
                      +1 →
                    </button>
                  </div>
                )}

                {s.sport === 'bike' && (
                  <div style={{ display: 'flex', background: '#EFE7DA', borderRadius: 9, padding: 3, gap: 3, alignSelf: 'flex-start' }}>
                    {(['outdoor', 'indoor'] as const).map((mo) => (
                      <button
                        key={mo}
                        onClick={() => setBikeMode((prev) => ({ ...prev, [s.id]: mo }))}
                        style={{
                          border: 'none',
                          borderRadius: 7,
                          padding: '5px 14px',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.64rem',
                          letterSpacing: '0.06em',
                          background: mode === mo ? 'var(--accent)' : 'transparent',
                          color: mode === mo ? '#FBF3EC' : 'var(--ink-2)',
                        }}
                      >
                        {mo === 'outdoor' ? 'OUTDOOR' : 'INDOOR'}
                      </button>
                    ))}
                  </div>
                )}

                {metrics.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
                    {metrics.map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--ink-3)' }}>{l}</span>
                        <span style={{ color: 'var(--ink-1)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', textAlign: 'right' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {clean(s.details) && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>{s.details}</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </MCard>
  )
}

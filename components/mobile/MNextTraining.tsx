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
const SPORT_LABEL: Record<string, string> = {
  swim: 'Schwimmen', bike: 'Rad', run: 'Laufen',
  strength: 'Kraft', brick: 'Brick', rest: 'Ruhe',
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
function isRunEvent(title: string): boolean {
  const t = title.toLowerCase()
  const nonRun = ['schwimm', 'swim', 'rad', 'bike', 'cycl', 'kraft', 'gym', 'strength']
  if (nonRun.some((kw) => t.includes(kw))) return false
  return ['run', 'lauf', 'jog', 'marathon', 'pace', 'intervals', 'easy', 'tempo run', 'long run', 'recovery run'].some((kw) => t.includes(kw))
}
function localDateFromEvent(e: CalendarEvent): string {
  if (!e.allDay) return e.start.slice(0, 10)
  return new Date(e.start).toLocaleDateString('en-CA')
}
function parseRunnaDistance(title: string): number | null {
  const m = title.match(/\((\d+[,.]\d*|\d+)\s*km\)/i)
  if (!m) return null
  return parseFloat(m[1].replace(',', '.'))
}
function parseRunnaWorkoutType(title: string): string | null {
  const dashIdx = title.lastIndexOf(' - ')
  if (dashIdx < 0) return null
  const after = title.slice(dashIdx + 3)
  const parenIdx = after.lastIndexOf(' (')
  return parenIdx > 0 ? after.slice(0, parenIdx).trim() : after.trim()
}

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
  locked: boolean
}

function fromPlan(s: TrainingPlanSession): DisplaySession {
  return {
    id: s.id, date: s.date, sport: s.sport, title: s.title,
    duration_min: s.duration_min, distance_km: s.distance_km,
    details: s.details, hf_zone: s.hf_zone, hf_range: s.hf_range,
    pace_speed: s.pace_speed, watts_indoor: s.watts_indoor, locked: false,
  }
}
function fromCalendarRun(e: CalendarEvent): DisplaySession {
  const durationMs = new Date(e.end).getTime() - new Date(e.start).getTime()
  const duration_min = !e.allDay && durationMs > 0 && durationMs < 8 * 3600000
    ? Math.round(durationMs / 60000) : null
  return {
    id: e.id, date: localDateFromEvent(e), sport: 'run', title: e.title,
    duration_min, distance_km: parseRunnaDistance(e.title),
    details: e.description ?? parseRunnaWorkoutType(e.title),
    hf_zone: null, hf_range: null, pace_speed: null, watts_indoor: null, locked: true,
  }
}

type Props = { doneActivityDates?: string[] }

export function MNextTraining({ doneActivityDates = [] }: Props) {
  const [sessions, setSessions] = useState<DisplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bikeMode, setBikeMode] = useState<Record<string, 'indoor' | 'outdoor'>>({})
  const [shifting, setShifting] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [planRes, calRes] = await Promise.all([
        fetch('/api/training/plan?days=21').then((r) => r.ok ? r.json() : { sessions: [] }),
        fetch('/api/calendar?days=21').then((r) => r.ok ? r.json() : []),
      ])
      const planSessions: DisplaySession[] = (Array.isArray(planRes?.sessions) ? planRes.sessions : []).map(fromPlan)
      const calEvents: CalendarEvent[] = Array.isArray(calRes) ? calRes : []
      const runEvents = calEvents.filter((e) => e.source !== 'training' && isRunEvent(e.title)).map(fromCalendarRun)
      const planIds = new Set(planSessions.map((s) => `${s.date}-${s.sport}`))
      const uniqueRuns = runEvents.filter((r) => !planIds.has(`${r.date}-run`))
      const merged = [...planSessions, ...uniqueRuns]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6)
      setSessions(merged)
    } catch (e) {
      console.error('[m/next] fetch error:', e)
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
      setSessions((prev) =>
        [...prev.map((x) => (x.id === s.id ? { ...x, date: newDate } : x))]
          .sort((a, b) => a.date.localeCompare(b.date))
      )
      if (selectedId === s.id) setSelectedId(null)
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
          ? [['Watt', clean(s.watts_indoor)], ['HF-Zone', clean(s.hf_zone)], ['HF-Bereich', clean(s.hf_range)], ['Dauer', fmtDur(s.duration_min) || null]]
          : [['HF-Zone', clean(s.hf_zone)], ['HF-Bereich', clean(s.hf_range)], ['Tempo', clean(s.pace_speed)], ['Dauer', fmtDur(s.duration_min) || null], ['Distanz', s.distance_km ? `${s.distance_km} km` : null]]
        : [['HF-Zone', clean(s.hf_zone)], ['HF-Bereich', clean(s.hf_range)], ['Tempo', clean(s.pace_speed)], ['Watt', clean(s.watts_indoor)], ['Dauer', fmtDur(s.duration_min) || null], ['Distanz', s.distance_km ? `${s.distance_km} km` : null]]
    return rows.filter((r): r is [string, string] => r[1] != null)
  }

  const doneSet = new Set(doneActivityDates)
  const selected = sessions.find((s) => s.id === selectedId) ?? null

  return (
    <MCard label="Nächste Trainings">
      {loading && <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Lädt…</div>}

      {!loading && sessions.length === 0 && (
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Nichts geplant</div>
      )}

      {/* 2-column tile grid */}
      {sessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {sessions.map((s) => {
            const isDone = doneSet.has(s.date)
            const isSelected = selectedId === s.id
            const color = SPORT_COLOR[s.sport] ?? 'var(--ink-3)'
            const subLabel = SPORT_LABEL[s.sport] ?? s.sport
            const meta = [fmtDur(s.duration_min), s.distance_km ? `${s.distance_km} km` : null].filter(Boolean).join(' · ')
            return (
              <div
                key={s.id}
                onClick={() => setSelectedId(isSelected ? null : s.id)}
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  padding: '11px 12px 10px',
                  background: isSelected ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.04)',
                  border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  minHeight: 74,
                  transition: 'border-color .15s',
                }}
              >
                {/* Sport dot + weekday + checkmark */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)' }}>
                      {wd(s.date)} {Number(s.date.slice(8, 10))}.
                    </span>
                  </div>
                  {isDone && (
                    <span style={{ fontSize: '0.8rem', color: '#5bbd72', lineHeight: 1 }}>✓</span>
                  )}
                </div>
                {/* Sport label */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.08em', color, textTransform: 'uppercase' }}>
                  {subLabel}
                </div>
                {/* Session title */}
                <div style={{ fontSize: '0.78rem', color: 'var(--ink-1)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title}
                </div>
                {/* Duration / distance */}
                {meta && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: 1 }}>
                    {meta}
                  </div>
                )}
                {/* RUNNA badge */}
                {s.locked && (
                  <div style={{ position: 'absolute', top: 9, right: 9, fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                    RUNNA
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Detail panel for selected tile */}
      {selected && (
        <div
          style={{
            marginTop: 10,
            padding: '12px 14px',
            background: 'rgba(0,0,0,0.05)',
            borderRadius: 10,
            border: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-1)', fontWeight: 600 }}>{selected.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)', marginTop: 2 }}>
                {wd(selected.date)}, {Number(selected.date.slice(8, 10))}. {new Date(selected.date + 'T12:00:00').toLocaleDateString('de-DE', { month: 'short' })}
                {shifting ? ' …' : ''}
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', fontSize: '1rem', cursor: 'pointer', padding: '0 4px' }}
            >
              ×
            </button>
          </div>

          {/* Bike indoor/outdoor toggle */}
          {selected.sport === 'bike' && (
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.06)', borderRadius: 9, padding: 3, gap: 3, alignSelf: 'flex-start' }}>
              {(['outdoor', 'indoor'] as const).map((mo) => {
                const mode = bikeMode[selected.id] ?? 'outdoor'
                return (
                  <button
                    key={mo}
                    onClick={() => setBikeMode((prev) => ({ ...prev, [selected.id]: mo }))}
                    style={{
                      border: 'none', borderRadius: 7, padding: '5px 14px', cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', fontSize: '0.64rem', letterSpacing: '0.06em',
                      background: mode === mo ? 'var(--accent)' : 'transparent',
                      color: mode === mo ? '#FBF3EC' : 'var(--ink-2)',
                    }}
                  >
                    {mo === 'outdoor' ? 'OUTDOOR' : 'INDOOR'}
                  </button>
                )
              })}
            </div>
          )}

          {/* Metrics */}
          {(() => {
            const mode = bikeMode[selected.id] ?? 'outdoor'
            const metrics = metricsFor(selected, mode)
            return metrics.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
                {metrics.map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--ink-3)' }}>{l}</span>
                    <span style={{ color: 'var(--ink-1)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            ) : null
          })()}

          {/* Description */}
          {clean(selected.details) && (
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>{selected.details}</div>
          )}

          {/* Shift buttons (plan sessions only) */}
          {!selected.locked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <button
                onClick={() => shiftDate(selected, -1)}
                disabled={!!shifting}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 14px', cursor: shifting ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', background: 'transparent', color: 'var(--ink-2)', opacity: shifting ? 0.4 : 1 }}
              >
                ← −1
              </button>
              <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-3)' }}>
                verschieben
              </span>
              <button
                onClick={() => shiftDate(selected, 1)}
                disabled={!!shifting}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 14px', cursor: shifting ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', background: 'transparent', color: 'var(--ink-2)', opacity: shifting ? 0.4 : 1 }}
              >
                +1 →
              </button>
            </div>
          )}
        </div>
      )}
    </MCard>
  )
}

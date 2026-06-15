'use client'

import { useEffect, useMemo, useState } from 'react'
import { Panel } from './Panel'
import type { CalendarEvent } from '@/lib/types'

const DAY_LABELS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'] as const

const TRAINING_KEYWORDS = ['training', 'swim', 'schwimm', 'rad', 'lauf', 'run', 'bike', 'triathlon', 'kraft']

type View = 'month' | 'week'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function mondayOf(d: Date): Date {
  const x = startOfDay(d)
  const dow = (x.getDay() + 6) % 7 // 0 = Monday
  x.setDate(x.getDate() - dow)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function isTrainingEvent(title: string): boolean {
  const lower = title.toLowerCase()
  return TRAINING_KEYWORDS.some((k) => lower.includes(k))
}

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const diff = date.getTime() - firstThursday.getTime()
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000))
}

// Visible day grid for the current view + anchor.
function gridFor(view: View, anchor: Date): Date[] {
  if (view === 'week') {
    const monday = mondayOf(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  }
  // month: 6 rows × 7 cols starting on the Monday on/before the 1st
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = mondayOf(firstOfMonth)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export function CalendarView() {
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => startOfDay(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [garminLatest, setGarminLatest] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => startOfDay(new Date()), [])
  const grid = useMemo(() => gridFor(view, anchor), [view, anchor])

  const fromKey = dateKey(grid[0])
  const toKey = dateKey(grid[grid.length - 1])

  // Fetch the visible range whenever it changes (per-view loading).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/calendar?from=${fromKey}&to=${toKey}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Calendar HTTP ${r.status}`)
        return r.json() as Promise<CalendarEvent[]>
      })
      .then((evts) => {
        if (cancelled) return
        setEvents(evts)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        console.error('CalendarView fetch error:', msg)
        setError(msg)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fromKey, toKey])

  // Garmin sync marker (once).
  useEffect(() => {
    fetch('/api/garmin/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((status) => setGarminLatest(status?.activities?.latest_date ?? null))
      .catch((e: unknown) => {
        console.error('CalendarView garmin status error:', e instanceof Error ? e.message : String(e))
      })
  }, [])

  function navigate(dir: -1 | 1) {
    setSelectedDay(null)
    setAnchor((prev) => {
      const x = new Date(prev)
      if (view === 'month') x.setMonth(x.getMonth() + dir)
      else x.setDate(x.getDate() + dir * 7)
      return x
    })
  }

  function goToday() {
    setAnchor(startOfDay(new Date()))
    setSelectedDay(startOfDay(new Date()))
  }

  function switchView(next: View) {
    setView(next)
    setSelectedDay(null)
  }

  const eventCountByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const ev of events) {
      const k = dateKey(new Date(ev.start))
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return map
  }, [events])

  const dayEvents = selectedDay
    ? events
        .filter((ev) => isSameDay(new Date(ev.start), selectedDay))
        .sort((a, b) => {
          if (a.allDay && !b.allDay) return -1
          if (!a.allDay && b.allDay) return 1
          return new Date(a.start).getTime() - new Date(b.start).getTime()
        })
    : []

  const title =
    view === 'month'
      ? anchor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      : `KW ${isoWeek(grid[0])} · ${grid[0].toLocaleDateString('de-DE', {
          day: 'numeric',
          month: 'short',
        })} – ${grid[6].toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`

  const nowMs = Date.now()
  const garminDate = garminLatest ? new Date(garminLatest) : null

  const navBtn: React.CSSProperties = {
    background: 'var(--line)',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    color: 'var(--ink-1)',
    cursor: 'pointer',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.8rem',
    padding: '0.3rem 0.6rem',
    lineHeight: 1,
  }

  function toggleBtn(active: boolean): React.CSSProperties {
    return {
      background: active ? '#F3E0D5' : 'transparent',
      border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
      borderRadius: '6px',
      color: active ? 'var(--accent)' : 'var(--ink-2)',
      cursor: 'pointer',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '0.65rem',
      letterSpacing: '0.05em',
      padding: '0.3rem 0.7rem',
    }
  }

  return (
    <Panel>
      {/* Header: title + view toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div className="panel-label" style={{ margin: 0 }}>
          KALENDER
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button style={toggleBtn(view === 'month')} onClick={() => switchView('month')}>
            MONAT
          </button>
          <button style={toggleBtn(view === 'week')} onClick={() => switchView('week')}>
            WOCHE
          </button>
        </div>
      </div>

      {/* Navigation row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <button style={navBtn} onClick={() => navigate(-1)} aria-label="Zurück">
          ‹
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              fontSize: '0.95rem',
              color: 'var(--ink-0)',
              fontFamily: 'ui-monospace, monospace',
              textTransform: view === 'month' ? 'capitalize' : 'none',
            }}
          >
            {title}
          </div>
          <button style={{ ...navBtn, fontSize: '0.6rem', padding: '0.25rem 0.5rem' }} onClick={goToday}>
            HEUTE
          </button>
        </div>
        <button style={navBtn} onClick={() => navigate(1)} aria-label="Vor">
          ›
        </button>
      </div>

      {/* Weekday header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.25rem',
          marginBottom: '0.25rem',
        }}
      >
        {DAY_LABELS.map((lbl) => (
          <div
            key={lbl}
            style={{
              textAlign: 'center',
              fontSize: '0.55rem',
              color: 'var(--ink-3)',
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '0.05em',
            }}
          >
            {lbl}
          </div>
        ))}
      </div>

      {/* Day grid (month = 6 rows, week = 1 row) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.25rem',
          marginBottom: '1rem',
        }}
      >
        {grid.map((day, i) => {
          const inMonth = view === 'week' || day.getMonth() === anchor.getMonth()
          const isToday = isSameDay(day, today)
          const isSelected = selectedDay != null && isSameDay(day, selectedDay)
          const evCount = eventCountByDay.get(dateKey(day)) ?? 0
          const hasSync = garminDate != null && isSameDay(garminDate, day)

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(startOfDay(day))}
              style={{
                textAlign: 'center',
                padding: view === 'week' ? '0.4rem 0.2rem' : '0.3rem 0.15rem',
                minHeight: view === 'week' ? 'auto' : '3rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                borderRadius: '6px',
                background: isSelected
                  ? '#F3E0D5'
                  : isToday
                  ? 'var(--line)'
                  : 'transparent',
                border: isSelected
                  ? '1px solid var(--accent)'
                  : isToday
                  ? '1px solid var(--line-strong)'
                  : '1px solid transparent',
                cursor: 'pointer',
                opacity: inMonth ? 1 : 0.32,
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  fontFamily: 'ui-monospace, monospace',
                  color: isSelected ? 'var(--accent)' : isToday ? 'var(--ink-0)' : 'var(--ink-2)',
                }}
              >
                {day.getDate()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '0.25rem', minHeight: '6px' }}>
                {evCount > 0 && (
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }} />
                )}
                {hasSync && (
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--ok)' }} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected day header */}
      <div
        style={{
          fontSize: '0.6rem',
          color: 'var(--ink-3)',
          fontFamily: 'ui-monospace, monospace',
          letterSpacing: '0.08em',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {selectedDay == null
          ? 'TAG WÄHLEN'
          : isSameDay(selectedDay, today)
          ? 'HEUTE'
          : selectedDay
              .toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })
              .toUpperCase()}
        {selectedDay != null && garminDate != null && isSameDay(garminDate, selectedDay) && (
          <span
            style={{
              fontSize: '0.55rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
              background: '#E6EDD6',
              color: 'var(--ok)',
              fontWeight: 600,
            }}
          >
            SYNC ✓
          </span>
        )}
      </div>

      {/* Events list */}
      {loading && <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Lädt...</div>}
      {error && <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Fehler: {error}</div>}
      {!loading && !error && selectedDay != null && dayEvents.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Keine Termine</div>
      )}

      {selectedDay != null &&
        dayEvents.map((ev, idx) => {
          const isPast = !ev.allDay && new Date(ev.end).getTime() < nowMs
          const isNow =
            !ev.allDay &&
            new Date(ev.start).getTime() <= nowMs &&
            new Date(ev.end).getTime() > nowMs

          return (
            <div
              key={ev.id}
              style={{
                padding: '0.5rem 0',
                borderBottom: idx < dayEvents.length - 1 ? '1px solid var(--line)' : 'none',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                opacity: isPast ? 0.45 : 1,
              }}
            >
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.65rem',
                  color: isNow ? 'var(--ok)' : 'var(--accent)',
                  whiteSpace: 'nowrap',
                  paddingTop: '0.1rem',
                  minWidth: '3.5rem',
                }}
              >
                {ev.allDay ? 'ganztäg.' : fmtTime(ev.start)}
                {isNow && ' ●'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--ink-1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {ev.title}
                  {isTrainingEvent(ev.title) && (
                    <span style={{ fontSize: '0.55rem', color: 'var(--accent)' }}>🏃</span>
                  )}
                </div>
                {ev.location && (
                  <div
                    style={{
                      fontSize: '0.65rem',
                      color: 'var(--ink-3)',
                      marginTop: '0.15rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ev.location}
                  </div>
                )}
              </div>
            </div>
          )
        })}
    </Panel>
  )
}

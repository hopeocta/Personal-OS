'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'
import type { CalendarEvent } from '@/lib/types'

const DAY_LABELS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'] as const

function getWeekDays(): Date[] {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7 // 0=Mon
  const monday = new Date(now)
  monday.setDate(now.getDate() - dow)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function sportColor(sport?: string): string {
  switch (sport) {
    case 'run': return 'var(--sport-run)'
    case 'bike': return 'var(--sport-bike)'
    case 'swim': return 'var(--sport-swim)'
    case 'strength': return 'var(--sport-strength)'
    case 'brick': return 'var(--accent)'
    default: return 'var(--accent)'
  }
}

export function CalendarCard() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [garminLatest, setGarminLatest] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const weekDays = getWeekDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    Promise.all([
      fetch('/api/calendar').then((r) => {
        if (!r.ok) throw new Error(`Calendar HTTP ${r.status}`)
        return r.json() as Promise<CalendarEvent[]>
      }),
      fetch('/api/garmin/status').then((r) => {
        if (!r.ok) return null
        return r.json()
      }),
    ])
      .then(([evts, status]) => {
        setEvents(evts)
        setGarminLatest(status?.activities?.latest_date ?? null)
        setLoading(false)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('CalendarCard fetch error:', msg)
        setError(msg)
        setLoading(false)
      })
  }, [])

  const dayEvents = events
    .filter((ev) => isSameDay(new Date(ev.start), selectedDay))
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1
      if (!a.allDay && b.allDay) return 1
      return new Date(a.start).getTime() - new Date(b.start).getTime()
    })

  const nowMs = Date.now()

  return (
    <Panel>
      <div className="panel-label">KALENDER</div>

      {/* Week strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.25rem',
          marginBottom: '1rem',
        }}
      >
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          const isSelected = isSameDay(day, selectedDay)
          const dayEvCount = events.filter((ev) => isSameDay(new Date(ev.start), day)).length
          const hasSyncedActivity = garminLatest != null && isSameDay(new Date(garminLatest), day)

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(new Date(day))}
              style={{
                textAlign: 'center',
                padding: '0.375rem 0.2rem',
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
              }}
            >
              <div
                style={{
                  fontSize: '0.6rem',
                  color: isSelected ? 'var(--accent)' : 'var(--ink-3)',
                  fontFamily: 'ui-monospace, monospace',
                  letterSpacing: '0.05em',
                }}
              >
                {DAY_LABELS[i]}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontFamily: 'ui-monospace, monospace',
                  color: isToday ? 'var(--ink-0)' : 'var(--ink-2)',
                  marginTop: '0.15rem',
                }}
              >
                {day.getDate()}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '0.2rem', minHeight: '6px' }}>
                {dayEvCount > 0 && (
                  <div
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                    }}
                  />
                )}
                {hasSyncedActivity && (
                  <div
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: 'var(--ok)',
                    }}
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Day label */}
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
        {isSameDay(selectedDay, today)
          ? 'HEUTE'
          : selectedDay
              .toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })
              .toUpperCase()}
        {garminLatest && isSameDay(new Date(garminLatest), selectedDay) && (
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
      {loading && (
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Lädt...</div>
      )}
      {error && (
        <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Fehler: {error}</div>
      )}
      {!loading && !error && dayEvents.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Keine Termine</div>
      )}

      {dayEvents.map((ev, idx) => {
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
              borderBottom:
                idx < dayEvents.length - 1
                  ? '1px solid var(--line)'
                  : 'none',
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
                color: ev.source === 'training' ? sportColor(ev.sport) : (isNow ? 'var(--ok)' : 'var(--accent)'),
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
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {ev.source === 'training' && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: sportColor(ev.sport), flex: '0 0 7px' }} />
                )}
                {ev.title}
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

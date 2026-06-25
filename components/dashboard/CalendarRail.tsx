'use client'

import { useEffect, useState } from 'react'
import type { CalendarEvent } from '@/lib/types'

const DAY_LABELS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'] as const

function getWeekDays(): Date[] {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
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
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function sportColor(sport?: string): string {
  switch (sport) {
    case 'run': return 'var(--sport-run)'
    case 'bike': return 'var(--sport-bike)'
    case 'swim': return 'var(--sport-swim)'
    case 'strength': return 'var(--sport-strength)'
    default: return 'var(--accent)'
  }
}

export function CalendarRail() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [garminLatest, setGarminLatest] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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
      fetch('/api/garmin/status').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([evts, status]) => {
        setEvents(evts)
        setGarminLatest(status?.activities?.latest_date ?? null)
        setLoading(false)
      })
      .catch((e: unknown) => {
        console.error('CalendarRail fetch error:', e instanceof Error ? e.message : String(e))
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

  const selectedLabel = isSameDay(selectedDay, today)
    ? 'HEUTE'
    : selectedDay
        .toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
        .toUpperCase()

  return (
    <div
      style={{
        borderBottom: '1px solid rgba(203,184,155,0.35)',
        background: 'rgba(242,238,227,0.55)',
        backdropFilter: 'blur(8px)',
        padding: '0.5rem 1.5rem 0.6rem',
      }}
    >
      {/* Day strip */}
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          const isSelected = isSameDay(day, selectedDay)
          const dayEvCount = events.filter((ev) => isSameDay(new Date(ev.start), day)).length
          const hasSync = garminLatest != null && isSameDay(new Date(garminLatest), day)

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(new Date(day))}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.1rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '7px',
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
                minWidth: '3.2rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.58rem',
                  color: isSelected ? 'var(--accent)' : 'var(--ink-3)',
                  fontFamily: 'ui-monospace, monospace',
                  letterSpacing: '0.05em',
                }}
              >
                {DAY_LABELS[i]}
              </span>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontFamily: 'ui-monospace, monospace',
                  color: isSelected ? 'var(--accent)' : isToday ? 'var(--ink-0)' : 'var(--ink-2)',
                  fontWeight: isToday || isSelected ? 600 : 400,
                }}
              >
                {day.getDate()}
              </span>
              <div style={{ display: 'flex', gap: '2px', minHeight: '5px' }}>
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
                {hasSync && (
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

        {/* Separator */}
        <div
          style={{
            width: '1px',
            height: '2.5rem',
            background: 'var(--line-strong)',
            margin: '0 0.5rem',
            flexShrink: 0,
          }}
        />

        {/* Events for selected day - horizontal list */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flex: 1,
            overflowX: 'auto',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.58rem',
              color: 'var(--ink-3)',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {selectedLabel}
          </span>

          {loading && (
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-3)' }}>…</span>
          )}

          {!loading && dayEvents.length === 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>Keine Termine</span>
          )}

          {dayEvents.map((ev) => {
            const isPast = !ev.allDay && new Date(ev.end).getTime() < nowMs
            const isNow =
              !ev.allDay &&
              new Date(ev.start).getTime() <= nowMs &&
              new Date(ev.end).getTime() > nowMs
            const color = ev.source === 'training' ? sportColor(ev.sport) : (isNow ? 'var(--ok)' : 'var(--accent)')

            return (
              <div
                key={ev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '5px',
                  background: isNow ? 'rgba(120,160,80,0.1)' : 'var(--line)',
                  border: isNow ? '1px solid var(--ok)' : '1px solid var(--line-strong)',
                  opacity: isPast ? 0.45 : 1,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {ev.source === 'training' && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.62rem',
                    color,
                  }}
                >
                  {ev.allDay ? '' : fmtTime(ev.start) + ' '}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--ink-1)',
                    maxWidth: '14rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ev.title}
                </span>
                {isNow && (
                  <span style={{ fontSize: '0.55rem', color: 'var(--ok)' }}>●</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

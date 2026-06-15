'use client'

import { useState, useEffect } from 'react'
import { Panel } from './Panel'
import type { CalendarEvent, GarminActivity } from '@/lib/types'

const DAY_SHORT = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO']

const TRAINING_KEYWORDS = [
  'training', 'swim', 'schwimm', 'rad', 'lauf', 'run', 'bike',
  'triathlon', 'kraft', 'yoga', 'sport', 'einheit',
]

function isTrainingEvent(title: string): boolean {
  const lower = title.toLowerCase()
  return TRAINING_KEYWORDS.some((k) => lower.includes(k))
}

function typeIcon(type: string | null): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('swim')) return '🏊'
  if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) return '🚴'
  if (t.includes('run')) return '🏃'
  if (t.includes('strength')) return '💪'
  return '🏋'
}

function fmtDuration(min: number | null): string {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function fmtHours(h: number): string {
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

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

type WeeklyTotals = { swimKm: number; bikeKm: number; runKm: number; totalHours: number }

export function TrainingWeekLive() {
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [activities, setActivities] = useState<GarminActivity[]>([])
  const [totals, setTotals] = useState<WeeklyTotals>({ swimKm: 0, bikeKm: 0, runKm: 0, totalHours: 0 })
  const [loading, setLoading] = useState(true)

  const weekDays = getWeekDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    Promise.all([
      fetch('/api/calendar').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/training/summary?days=7').then((r) => (r.ok ? r.json() : { activities: [], swimKm: 0, bikeKm: 0, runKm: 0, totalHours: 0 })),
    ])
      .then(([evts, summary]: [unknown, { activities: GarminActivity[]; swimKm: number; bikeKm: number; runKm: number; totalHours: number }]) => {
        const allEvents: CalendarEvent[] = Array.isArray(evts) ? evts : []
        setCalEvents(allEvents.filter((e) => isTrainingEvent(e.title)))
        setActivities(Array.isArray(summary.activities) ? summary.activities : [])
        setTotals({
          swimKm: summary.swimKm ?? 0,
          bikeKm: summary.bikeKm ?? 0,
          runKm: summary.runKm ?? 0,
          totalHours: summary.totalHours ?? 0,
        })
      })
      .catch((e) => console.error('[TrainingWeekLive] error:', e))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Panel>
      <div className="panel-label">TRAININGSWOCHE</div>

      {/* 7-day dot strip */}
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
          const isPast = day < today && !isToday
          const hasActivity = activities.some((a) =>
            isSameDay(new Date(a.date + 'T00:00:00'), day)
          )
          const hasPlanned = calEvents.some((e) => isSameDay(new Date(e.start), day))

          let dotColor = '#EFE7D6'
          if (hasActivity) dotColor = 'var(--ok)'
          else if (hasPlanned && isPast) dotColor = 'var(--danger)'
          else if (hasPlanned) dotColor = 'var(--warn)'

          return (
            <div
              key={i}
              style={{
                textAlign: 'center',
                padding: '0.375rem 0.2rem',
                borderRadius: '6px',
                background: isToday ? 'var(--line)' : 'var(--line)',
                border: isToday
                  ? '1px solid var(--line-strong)'
                  : '1px solid transparent',
              }}
            >
              <div
                style={{
                  fontSize: '0.6rem',
                  color: isToday ? 'var(--accent)' : 'var(--ink-3)',
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {DAY_SHORT[i]}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'ui-monospace, monospace',
                  color: isToday ? 'var(--ink-0)' : 'var(--ink-2)',
                  marginTop: '0.15rem',
                }}
              >
                {day.getDate()}
              </div>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: dotColor,
                  margin: '0.3rem auto 0',
                }}
              />
            </div>
          )
        })}
      </div>

      {loading && (
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
          Lädt...
        </div>
      )}

      {/* Day-by-day breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          const isPast = day < today && !isToday


          const dayActivities = activities.filter((a) =>
            isSameDay(new Date(a.date + 'T00:00:00'), day)
          )
          const dayCalEvents = calEvents.filter((e) => isSameDay(new Date(e.start), day))

          if (!dayActivities.length && !dayCalEvents.length) return null

          const hasDone = dayActivities.length > 0
          const hasMissed = !hasDone && dayCalEvents.length > 0 && isPast
          const hasPending = !hasDone && dayCalEvents.length > 0 && !isPast

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                padding: '0.4rem 0',
                borderBottom: '1px solid var(--line)',
                opacity: isPast && !hasDone ? 0.55 : 1,
              }}
            >
              <div
                style={{
                  fontSize: '0.65rem',
                  color: isToday ? 'var(--accent)' : 'var(--ink-3)',
                  fontFamily: 'ui-monospace, monospace',
                  minWidth: '3.5rem',
                  paddingTop: '0.05rem',
                }}
              >
                {DAY_SHORT[i]} {day.getDate()}.
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                {dayCalEvents.map((ev) => (
                  <div key={ev.id} style={{ fontSize: '0.7rem', color: 'var(--ink-3)' }}>
                    📅 {ev.title}
                  </div>
                ))}
                {dayActivities.map((a) => (
                  <div key={a.id} style={{ fontSize: '0.7rem', color: 'var(--ink-1)' }}>
                    {typeIcon(a.type)}{' '}
                    {a.name || a.type}
                    {a.duration_min ? ` — ${fmtDuration(a.duration_min)}` : ''}
                    {a.distance_km ? `, ${a.distance_km.toFixed(1)} km` : ''}
                  </div>
                ))}
              </div>

              <div style={{ flexShrink: 0 }}>
                {hasDone && (
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.6rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      background: '#E6EDD6',
                      color: 'var(--ok)',
                      fontWeight: 600,
                    }}
                  >
                    DONE ✓
                  </span>
                )}
                {hasMissed && (
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.6rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      background: '#F3D8D8',
                      color: 'var(--danger)',
                      fontWeight: 600,
                    }}
                  >
                    VERPASST
                  </span>
                )}
                {hasPending && (
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.6rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      background: '#F5E8CC',
                      color: 'var(--warn)',
                      fontWeight: 600,
                    }}
                  >
                    AUSSTEHEND
                  </span>
                )}
                {!hasDone && !dayCalEvents.length && (
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.6rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      background: '#F3E0D5',
                      color: 'var(--accent)',
                      fontWeight: 600,
                    }}
                  >
                    EXTRA
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Weekly totals */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--line)',
        }}
      >
        {[
          { val: `${totals.swimKm} km`, label: 'SWIM' },
          { val: `${totals.bikeKm} km`, label: 'BIKE' },
          { val: `${totals.runKm} km`, label: 'RUN' },
          { val: fmtHours(totals.totalHours), label: 'GESAMT' },
        ].map(({ val, label }) => (
          <div key={label}>
            <div
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '1rem',
                color: 'var(--ink-0)',
              }}
            >
              {val}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--ink-3)' }}>{label}</div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Panel } from './Panel'
import type { CalendarEvent, GarminActivity } from '@/lib/types'

const DAY_SHORT = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO']

const TRAINING_KEYWORDS = [
  'training', 'swim', 'schwimm', 'rad', 'lauf', 'run', 'bike',
  'triathlon', 'kraft', 'yoga', 'sport', 'einheit',
]

type TrainType = 'swim' | 'bike' | 'run' | 'strength' | null

function isTrainingEvent(title: string): boolean {
  const lower = title.toLowerCase()
  return TRAINING_KEYWORDS.some((k) => lower.includes(k))
}

function eventTrainType(title: string): TrainType {
  const t = title.toLowerCase()
  if (t.includes('schwimm') || t.includes('swim')) return 'swim'
  if (t.includes('rad') || t.includes('bike') || t.includes('cycl')) return 'bike'
  if (t.includes('lauf') || t.includes('run')) return 'run'
  if (t.includes('kraft') || t.includes('strength')) return 'strength'
  return null
}

function activityTrainType(type: string | null): TrainType {
  const t = (type ?? '').toLowerCase()
  if (t.includes('swim')) return 'swim'
  if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) return 'bike'
  if (t.includes('run')) return 'run'
  if (t.includes('strength')) return 'strength'
  return null
}

function typeIcon(type: TrainType): string {
  switch (type) {
    case 'swim': return '🏊'
    case 'bike': return '🚴'
    case 'run': return '🏃'
    case 'strength': return '💪'
    default: return '🏋'
  }
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

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekDays(): Date[] {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const monday = startOfDay(now)
  monday.setDate(now.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

const BADGE = {
  done: { label: 'DONE ✓', bg: '#E6EDD6', color: 'var(--ok)' },
  missed: { label: 'VERPASST', bg: '#F3D8D8', color: 'var(--danger)' },
  pending: { label: 'AUSSTEHEND', bg: '#F5E8CC', color: 'var(--warn)' },
  planned: { label: 'GEPLANT', bg: '#EFE7D6', color: 'var(--ink-3)' },
  extra: { label: 'GARMIN', bg: '#F3E0D5', color: 'var(--accent)' },
} as const

type Totals = { swimKm: number; bikeKm: number; runKm: number; totalHours: number }

export function TrainingCard() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [activities, setActivities] = useState<GarminActivity[]>([])
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const weekDays = useMemo(() => getWeekDays(), [])
  const today = useMemo(() => startOfDay(new Date()), [])

  useEffect(() => {
    const from = dateKey(weekDays[0])
    const to = dateKey(weekDays[6])
    Promise.all([
      fetch(`/api/calendar?from=${from}&to=${to}`).then((r) => {
        if (!r.ok) throw new Error(`Calendar HTTP ${r.status}`)
        return r.json() as Promise<CalendarEvent[]>
      }),
      fetch('/api/training/summary?days=14').then((r) =>
        r.ok ? r.json() : { activities: [] }
      ),
    ])
      .then(([evts, summary]) => {
        setEvents(Array.isArray(evts) ? evts : [])
        setActivities(Array.isArray(summary?.activities) ? summary.activities : [])
        setLoading(false)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[TrainingCard] fetch error:', msg)
        setError(msg)
        setLoading(false)
      })
  }, [weekDays])

  // Weekly totals from this week's Garmin activities
  const totals = useMemo<Totals>(() => {
    const t: Totals = { swimKm: 0, bikeKm: 0, runKm: 0, totalHours: 0 }
    let mins = 0
    for (const a of activities) {
      const d = new Date(a.date + 'T00:00:00')
      if (d < weekDays[0] || d > weekDays[6]) continue
      mins += a.duration_min ?? 0
      const km = a.distance_km ?? 0
      switch (activityTrainType(a.type)) {
        case 'swim': t.swimKm += km; break
        case 'bike': t.bikeKm += km; break
        case 'run': t.runKm += km; break
      }
    }
    t.swimKm = Math.round(t.swimKm * 10) / 10
    t.bikeKm = Math.round(t.bikeKm * 10) / 10
    t.runKm = Math.round(t.runKm * 10) / 10
    t.totalHours = Math.round((mins / 60) * 10) / 10
    return t
  }, [activities, weekDays])

  // All real Garmin activities logged this week so far, sorted chronologically.
  const weekActivities = useMemo(
    () =>
      activities
        .filter((a) => {
          const d = new Date(a.date + 'T00:00:00')
          return d >= weekDays[0] && d <= weekDays[6]
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    [activities, weekDays]
  )

  const dayActivities = useMemo(
    () => activities.filter((a) => isSameDay(new Date(a.date + 'T00:00:00'), selectedDay)),
    [activities, selectedDay]
  )

  const dayEvents = useMemo(
    () =>
      events
        .filter((ev) => isSameDay(new Date(ev.start), selectedDay))
        .sort((a, b) => {
          if (a.allDay && !b.allDay) return -1
          if (!a.allDay && b.allDay) return 1
          return new Date(a.start).getTime() - new Date(b.start).getTime()
        }),
    [events, selectedDay]
  )

  const isPastDay = selectedDay < today && !isSameDay(selectedDay, today)

  // Match training events to Garmin activities (each activity used at most once).
  const matched = useMemo(() => {
    const pool = [...dayActivities]
    const rows = dayEvents.map((ev) => {
      const training = isTrainingEvent(ev.title)
      let act: GarminActivity | undefined
      if (training) {
        const wanted = eventTrainType(ev.title)
        const idx = pool.findIndex(
          (a) => wanted == null || activityTrainType(a.type) === wanted
        )
        if (idx !== -1) {
          act = pool[idx]
          pool.splice(idx, 1)
        }
      }
      return { ev, training, act }
    })
    return { rows, extras: pool } // extras = Garmin activities without a matching event
  }, [dayEvents, dayActivities])

  return (
    <Panel>
      <div className="panel-label">TRAINING</div>

      {/* Clickable week strip */}
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
          const isPast = day < today && !isToday
          const hasActivity = activities.some((a) =>
            isSameDay(new Date(a.date + 'T00:00:00'), day)
          )
          const hasTraining = events.some(
            (e) => isTrainingEvent(e.title) && isSameDay(new Date(e.start), day)
          )

          let dotColor = '#EFE7D6'
          if (hasActivity) dotColor = 'var(--ok)'
          else if (hasTraining && isPast) dotColor = 'var(--danger)'
          else if (hasTraining) dotColor = 'var(--warn)'

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(startOfDay(day))}
              style={{
                textAlign: 'center',
                padding: '0.375rem 0.2rem',
                borderRadius: '6px',
                cursor: 'pointer',
                background: isSelected
                  ? '#F3E0D5'
                  : isToday
                  ? 'var(--line)'
                  : 'var(--line)',
                border: isSelected
                  ? '1px solid var(--accent)'
                  : isToday
                  ? '1px solid var(--line-strong)'
                  : '1px solid transparent',
              }}
            >
              <div
                style={{
                  fontSize: '0.6rem',
                  color: isSelected ? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--ink-3)',
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
            </button>
          )
        })}
      </div>

      {/* Selected day label */}
      <div
        style={{
          fontSize: '0.6rem',
          color: 'var(--ink-3)',
          fontFamily: 'ui-monospace, monospace',
          letterSpacing: '0.08em',
          marginBottom: '0.5rem',
        }}
      >
        {isSameDay(selectedDay, today)
          ? 'HEUTE'
          : selectedDay
              .toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })
              .toUpperCase()}
      </div>

      {loading && <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Lädt...</div>}
      {error && <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Fehler: {error}</div>}
      {!loading && !error && dayEvents.length === 0 && matched.extras.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Keine Termine</div>
      )}

      {/* Calendar events for the day */}
      {matched.rows.map(({ ev, training, act }) => {
        let badge: { label: string; bg: string; color: string } | null = null
        if (training) {
          if (act) badge = BADGE.done
          else if (isPastDay) badge = BADGE.missed
          else if (isSameDay(selectedDay, today)) badge = BADGE.pending
          else badge = BADGE.planned
        }
        const trainType = eventTrainType(ev.title)

        return (
          <div
            key={ev.id}
            style={{
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '0.5rem',
              borderLeft: training ? '2px solid var(--accent)' : '2px solid transparent',
              paddingLeft: '0.5rem',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: training ? 'var(--ink-0)' : 'var(--ink-2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span style={{ color: 'var(--accent)', fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem' }}>
                  {ev.allDay ? 'ganztäg.' : fmtTime(ev.start)}
                </span>
                {training && <span>{typeIcon(trainType)}</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.title}
                </span>
              </div>
              {act && (
                <div style={{ fontSize: '0.65rem', color: 'var(--ink-3)', marginTop: '0.2rem' }}>
                  Garmin — {act.distance_km ? `${act.distance_km.toFixed(1)} km` : act.type}
                  {act.duration_min ? `, ${fmtDuration(act.duration_min)}` : ''}
                  {act.avg_hr ? `, Ø ${act.avg_hr} bpm` : ''}
                </div>
              )}
            </div>
            {badge && (
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.6rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  background: badge.bg,
                  color: badge.color,
                }}
              >
                {badge.label}
              </span>
            )}
          </div>
        )
      })}

      {/* Garmin activities without a matching calendar event */}
      {matched.extras.map((a) => (
        <div
          key={a.id}
          style={{
            padding: '0.5rem 0 0.5rem 0.5rem',
            borderBottom: '1px solid var(--line)',
            borderLeft: '2px solid var(--ok)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-0)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>{typeIcon(activityTrainType(a.type))}</span>
              <span>{a.name || a.type}</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--ink-3)', marginTop: '0.2rem' }}>
              Garmin — {a.distance_km ? `${a.distance_km.toFixed(1)} km` : a.type}
              {a.duration_min ? `, ${fmtDuration(a.duration_min)}` : ''}
              {a.avg_hr ? `, Ø ${a.avg_hr} bpm` : ''}
            </div>
          </div>
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.6rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              background: BADGE.done.bg,
              color: BADGE.done.color,
            }}
          >
            {BADGE.done.label}
          </span>
        </div>
      ))}

      {/* Weekly totals (real Garmin data) */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--line)',
        }}
      >
        {[
          { val: `${totals.swimKm}km`, label: 'SWIM' },
          { val: `${totals.bikeKm}km`, label: 'BIKE' },
          { val: `${totals.runKm}km`, label: 'RUN' },
          { val: fmtHours(totals.totalHours), label: 'GESAMT' },
        ].map(({ val, label }) => (
          <div key={label}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.1rem', color: 'var(--ink-0)' }}>
              {val}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--ink-3)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Week so far — all real activities logged this week */}
      <div
        style={{
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            fontSize: '0.6rem',
            color: 'var(--ink-3)',
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.08em',
            marginBottom: '0.5rem',
          }}
        >
          WOCHE BISHER {weekActivities.length > 0 && `(${weekActivities.length})`}
        </div>

        {weekActivities.length === 0 ? (
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>
            Noch keine Aktivitäten diese Woche
          </div>
        ) : (
          weekActivities.map((a) => {
            const d = new Date(a.date + 'T00:00:00')
            const idx = (d.getDay() + 6) % 7
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.3rem 0',
                  fontSize: '0.72rem',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span
                  style={{
                    minWidth: '3.2rem',
                    color: 'var(--ink-3)',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.62rem',
                  }}
                >
                  {DAY_SHORT[idx]} {d.getDate()}.
                </span>
                <span>{typeIcon(activityTrainType(a.type))}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: 'var(--ink-1)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.name || a.type}
                </span>
                <span
                  style={{
                    color: 'var(--ink-3)',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.62rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.duration_min ? fmtDuration(a.duration_min) : ''}
                  {a.distance_km ? ` · ${a.distance_km.toFixed(1)}km` : ''}
                </span>
              </div>
            )
          })
        )}
      </div>
    </Panel>
  )
}

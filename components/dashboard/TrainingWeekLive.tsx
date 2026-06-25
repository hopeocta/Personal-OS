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
  const [allCalEvents, setAllCalEvents] = useState<CalendarEvent[]>([])
  const [activities, setActivities] = useState<GarminActivity[]>([])
  const [totals, setTotals] = useState<WeeklyTotals>({ swimKm: 0, bikeKm: 0, runKm: 0, totalHours: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const weekDays = getWeekDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Nur Training-Events für Dot-Berechnung
  const calEvents = allCalEvents.filter((e) => isTrainingEvent(e.title))

  useEffect(() => {
    Promise.all([
      fetch('/api/calendar').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/training/summary?days=7').then((r) => (r.ok ? r.json() : { activities: [], swimKm: 0, bikeKm: 0, runKm: 0, totalHours: 0 })),
    ])
      .then(([evts, summary]: [unknown, { activities: GarminActivity[]; swimKm: number; bikeKm: number; runKm: number; totalHours: number }]) => {
        setAllCalEvents(Array.isArray(evts) ? evts : [])
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

      {/* 7-day clickable strip */}
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
          const hasPlanned = calEvents.some((e) => isSameDay(new Date(e.start), day))

          let dotColor = '#EFE7D6'
          if (hasActivity) dotColor = 'var(--ok)'
          else if (hasPlanned && isPast) dotColor = 'var(--danger)'
          else if (hasPlanned) dotColor = 'var(--warn)'

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(new Date(day))}
              style={{
                textAlign: 'center',
                padding: '0.375rem 0.2rem',
                borderRadius: '6px',
                background: isSelected ? '#F3E0D5' : isToday ? '#EDE3D0' : 'var(--line)',
                border: isSelected
                  ? '2px solid var(--accent)'
                  : isToday
                  ? '2px solid var(--accent)'
                  : '1px solid transparent',
                boxShadow: isToday && !isSelected ? '0 0 0 1px var(--accent)' : 'none',
                cursor: 'pointer',
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
                  color: isSelected ? 'var(--accent)' : isToday ? 'var(--ink-0)' : 'var(--ink-2)',
                  fontWeight: isSelected || isToday ? 600 : 400,
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

      {loading && (
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
          Lädt...
        </div>
      )}

      {/* Detail des gewählten Tages */}
      {!loading && (() => {
        const dayActivities = activities.filter((a) =>
          isSameDay(new Date(a.date + 'T00:00:00'), selectedDay)
        )
        const dayTrainingEvents = calEvents.filter((e) => isSameDay(new Date(e.start), selectedDay))
        const dayAllEvents = allCalEvents.filter((e) => isSameDay(new Date(e.start), selectedDay))
        const dayOtherEvents = dayAllEvents.filter((e) => !isTrainingEvent(e.title))

        const isPast = selectedDay < today && !isSameDay(selectedDay, today)
        const hasDone = dayActivities.length > 0
        const hasMissed = !hasDone && dayTrainingEvents.length > 0 && isPast
        const hasPending = !hasDone && dayTrainingEvents.length > 0 && !isPast

        const label = isSameDay(selectedDay, today)
          ? 'HEUTE'
          : selectedDay.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()

        return (
          <div style={{ marginBottom: '1rem', borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
            {/* Tag-Label + Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--ink-3)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em' }}>
                {label}
              </span>
              {hasDone && (
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.58rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#E6EDD6', color: 'var(--ok)', fontWeight: 600 }}>
                  DONE ✓
                </span>
              )}
              {hasMissed && (
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.58rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#F3D8D8', color: 'var(--danger)', fontWeight: 600 }}>
                  VERPASST
                </span>
              )}
              {hasPending && (
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.58rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#F5E8CC', color: 'var(--warn)', fontWeight: 600 }}>
                  AUSSTEHEND
                </span>
              )}
            </div>

            {/* Trainings-Events (geplant) */}
            {dayTrainingEvents.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: '0.75rem' }}>{ev.allDay ? 'ganztäg.' : new Date(ev.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-1)' }}>🏃 {ev.title}</span>
              </div>
            ))}

            {/* Garmin Aktivitäten (gemacht) */}
            {dayActivities.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--ok)', fontFamily: 'ui-monospace, monospace' }}>✓</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-1)' }}>
                  {typeIcon(a.type)} {a.name || a.type}
                  {a.duration_min ? ` — ${fmtDuration(a.duration_min)}` : ''}
                  {a.distance_km ? `, ${a.distance_km.toFixed(1)} km` : ''}
                </span>
              </div>
            ))}

            {/* Sonstige Kalender-Termine */}
            {dayOtherEvents.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--line)', opacity: 0.8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)', fontFamily: 'ui-monospace, monospace' }}>
                  {ev.allDay ? 'ganztäg.' : new Date(ev.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-2)' }}>📅 {ev.title}</span>
              </div>
            ))}

            {dayActivities.length === 0 && dayTrainingEvents.length === 0 && dayOtherEvents.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Keine Einträge</div>
            )}
          </div>
        )
      })()}

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

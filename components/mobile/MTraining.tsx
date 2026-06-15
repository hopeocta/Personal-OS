'use client'

import { useEffect, useState } from 'react'
import { MCard } from './MCard'
import type { GarminActivity, TrainingPlanSession } from '@/lib/types'

const SPORT_COLOR: Record<string, string> = {
  swim: 'var(--sport-swim)',
  bike: 'var(--sport-bike)',
  run: 'var(--sport-run)',
  strength: 'var(--sport-strength)',
  brick: 'var(--accent)',
  rest: 'var(--sport-rest)',
  other: 'var(--ink-3)',
}
const DAY = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']

function actSport(type: string | null): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('swim')) return 'swim'
  if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) return 'bike'
  if (t.includes('run')) return 'run'
  if (t.includes('strength')) return 'strength'
  return 'other'
}
function fmtDur(min: number | null): string {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}
function wd(date: string): string {
  return DAY[new Date(date + 'T12:00:00').getDay()]
}

export function MTraining() {
  const [acts, setActs] = useState<GarminActivity[]>([])
  const [plan, setPlan] = useState<TrainingPlanSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/training/summary?days=7').then((r) => (r.ok ? r.json() : { activities: [] })),
      fetch('/api/training/plan?days=8').then((r) => (r.ok ? r.json() : { sessions: [] })),
    ])
      .then((results) => {
        const s = results[0] as { activities?: GarminActivity[] }
        const p = results[1] as { sessions?: TrainingPlanSession[] }
        setActs(Array.isArray(s?.activities) ? s.activities : [])
        setPlan(Array.isArray(p?.sessions) ? p.sessions : [])
      })
      .catch((e) => {
        console.error('[m/training] fetch error:', e)
        setError('Training konnte nicht geladen werden')
      })
      .finally(() => setLoading(false))
  }, [])

  const totals = acts.reduce(
    (t, a) => {
      t.mins += a.duration_min ?? 0
      const km = a.distance_km ?? 0
      const s = actSport(a.type)
      if (s === 'swim') t.swim += km
      else if (s === 'bike') t.bike += km
      else if (s === 'run') t.run += km
      return t
    },
    { mins: 0, swim: 0, bike: 0, run: 0 },
  )
  const hours = Math.round((totals.mins / 60) * 10) / 10
  const recent = [...acts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const chips: [string, number][] = [
    ['swim', totals.swim],
    ['bike', totals.bike],
    ['run', totals.run],
  ]

  return (
    <MCard label="Training · letzte 7 Tage">
      {loading && <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Lädt…</div>}
      {error && <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{error}</div>}

      {!loading && !error && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '1.7rem', color: 'var(--ink-0)' }}>
              {acts.length}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)' }}>EINHEITEN</span>
            <span
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '1.7rem', color: 'var(--ink-0)', marginLeft: 8 }}
            >
              {hours}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)' }}>STD</span>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: recent.length ? 12 : 0, flexWrap: 'wrap' }}>
            {chips.map(([s, km]) => (
              <span
                key={s}
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: '#FFFDF8',
                  border: '1px solid var(--line)',
                  borderRadius: 20,
                  padding: '3px 9px',
                  fontSize: '0.66rem',
                  color: 'var(--ink-2)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: SPORT_COLOR[s],
                    marginRight: 5,
                  }}
                />
                {Math.round(km * 10) / 10} km
              </span>
            ))}
          </div>

          {recent.map((a) => {
            const s = actSport(a.type)
            return (
              <div
                key={a.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--line)', fontSize: '0.76rem' }}
              >
                <span style={{ minWidth: '2.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)' }}>
                  {wd(a.date)} {Number(a.date.slice(8, 10))}.
                </span>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: SPORT_COLOR[s], flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name || a.type}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                  {fmtDur(a.duration_min)}
                  {a.distance_km ? ` · ${a.distance_km.toFixed(1)}km` : ''}
                </span>
              </div>
            )
          })}

          <div
            style={{
              marginTop: 14,
              marginBottom: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.62rem',
              letterSpacing: '0.12em',
              color: 'var(--ink-3)',
            }}
          >
            DIESE WOCHE GEPLANT
          </div>

          {plan.length === 0 ? (
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>Nichts geplant</div>
          ) : (
            plan.slice(0, 6).map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: '0.76rem' }}>
                <span style={{ minWidth: '2.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)' }}>
                  {wd(s.date)} {Number(s.date.slice(8, 10))}.
                </span>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: SPORT_COLOR[s.sport] || 'var(--ink-3)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                  {s.duration_min ? fmtDur(s.duration_min) : s.distance_km ? `${s.distance_km}km` : ''}
                </span>
              </div>
            ))
          )}
        </>
      )}
    </MCard>
  )
}

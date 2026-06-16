'use client'

import { useEffect, useState } from 'react'
import { MCard } from './MCard'
import type { TrainingPlanSession } from '@/lib/types'

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

export function MNextTraining() {
  const [plan, setPlan] = useState<TrainingPlanSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [bikeMode, setBikeMode] = useState<Record<string, 'indoor' | 'outdoor'>>({})

  useEffect(() => {
    fetch('/api/training/plan?days=8')
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((p) => setPlan(Array.isArray(p?.sessions) ? p.sessions : []))
      .catch((e) => {
        console.error('[m/next] fetch error:', e)
        setError('Plan konnte nicht geladen werden')
      })
      .finally(() => setLoading(false))
  }, [])

  const metricsFor = (s: TrainingPlanSession, mode: 'indoor' | 'outdoor'): [string, string][] => {
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

  const shown = plan.slice(0, 7)

  return (
    <MCard label="Nächste Trainings">
      {loading && <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Lädt…</div>}
      {error && <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{error}</div>}
      {!loading && !error && shown.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Nichts geplant</div>
      )}

      {shown.map((s, i) => {
        const isOpen = openId === s.id
        const mode = bikeMode[s.id] ?? 'outdoor'
        const metrics = metricsFor(s, mode)
        return (
          <div key={s.id} style={{ borderBottom: i < shown.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div
              onClick={() => setOpenId(isOpen ? null : s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', cursor: 'pointer' }}
            >
              <span style={{ minWidth: '2.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--ink-3)' }}>
                {wd(s.date)} {Number(s.date.slice(8, 10))}.
              </span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SPORT_COLOR[s.sport] || 'var(--ink-3)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, color: 'var(--ink-1)', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.title}
              </span>
              {s.duration_min ? (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--ink-3)' }}>{fmtDur(s.duration_min)}</span>
              ) : null}
              <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', transition: 'transform .15s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                ▾
              </span>
            </div>

            {isOpen && (
              <div style={{ padding: '2px 0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.76rem' }}>
                        <span style={{ color: 'var(--ink-3)' }}>{l}</span>
                        <span style={{ color: 'var(--ink-1)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', textAlign: 'right' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {clean(s.details) && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>{s.details}</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </MCard>
  )
}

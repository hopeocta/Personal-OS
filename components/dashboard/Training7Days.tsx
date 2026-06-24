'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'
import type { GarminActivity } from '@/lib/types'

const SPORT_COL: Record<string, string> = {
  running:      'var(--sport-run)',
  trail_running:'var(--sport-run)',
  cycling:      'var(--sport-bike)',
  indoor_cycling:'var(--sport-bike)',
  road_biking:  'var(--sport-bike)',
  virtual_ride: 'var(--sport-bike)',
  lap_swimming: 'var(--sport-swim)',
  open_water_swimming: 'var(--sport-swim)',
  strength_training: 'var(--sport-strength)',
  multi_sport:  'var(--accent)',
}

const SPORT_LABEL: Record<string, string> = {
  running: 'Laufen', trail_running: 'Trail',
  cycling: 'Rad', indoor_cycling: 'Indoor Rad', road_biking: 'Rad', virtual_ride: 'Indoor Rad',
  lap_swimming: 'Schwimmen', open_water_swimming: 'Freiwasser',
  strength_training: 'Kraft', multi_sport: 'Triathlon',
}

const DAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function fmtDur(min: number | null): string {
  if (!min) return ''
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

type Summary = { swimKm: number; bikeKm: number; runKm: number; totalHours: number; activities: GarminActivity[] }

export function Training7Days() {
  const [data, setData]     = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/training/summary?days=7')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const acts   = data?.activities ?? []
  const recent = [...acts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  return (
    <Panel>
      <div className="panel-label">Training · letzte 7 Tage</div>

      {loading && <div style={{ color: 'var(--ink-3)', fontSize: '0.75rem', marginTop: 8 }}>Lädt…</div>}

      {!loading && (
        <>
          {/* Zahlen-Kacheln */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '10px 0 14px' }}>
            {[
              { label: 'Einheiten', value: String(acts.length), color: 'var(--ink-0)' },
              { label: '🏊 Schwimm', value: `${data?.swimKm ?? 0} km`, color: 'var(--sport-swim)' },
              { label: '🚴 Rad',     value: `${data?.bikeKm ?? 0} km`, color: 'var(--sport-bike)' },
              { label: '🏃 Laufen',  value: `${data?.runKm  ?? 0} km`, color: 'var(--sport-run)'  },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'var(--ink-4)', borderRadius: 8, padding: '8px 10px',
                border: '1px solid var(--line)',
              }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 500, color, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Aktivitätsliste */}
          {recent.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Keine Aktivitäten in den letzten 7 Tagen</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recent.map(a => {
                const col   = SPORT_COL[a.type ?? ''] ?? 'var(--ink-3)'
                const label = SPORT_LABEL[a.type ?? ''] ?? (a.type ?? 'Aktivität').replace(/_/g, ' ')
                const d     = new Date(a.date + 'T12:00:00')
                const dist  = a.distance_km != null && a.distance_km > 0 ? ` · ${a.distance_km} km` : ''
                const dur   = fmtDur(a.duration_min)
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 0', borderTop: '1px solid var(--line)',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--ink-3)', minWidth: 24, fontFamily: 'var(--font-mono)' }}>
                      {DAY[d.getDay()]}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.name || label}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {dur}{dist}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}

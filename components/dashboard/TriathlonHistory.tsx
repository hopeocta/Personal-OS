'use client'

import { useState, useEffect } from 'react'
import { Panel } from './Panel'
import type { GarminActivity } from '@/lib/types'

type FilterType = 'alle' | 'schwimmen' | 'radfahren' | 'laufen' | 'kraft'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'schwimmen', label: '🏊 Schwimmen' },
  { value: 'radfahren', label: '🚴 Radfahren' },
  { value: 'laufen', label: '🏃 Laufen' },
  { value: 'kraft', label: '💪 Kraft' },
]

function matchesFilter(type: string | null, filter: FilterType): boolean {
  if (filter === 'alle') return true
  const t = (type ?? '').toLowerCase()
  if (filter === 'schwimmen') return t.includes('swim')
  if (filter === 'radfahren') return t.includes('cycl') || t.includes('bike') || t.includes('ride')
  if (filter === 'laufen') return t.includes('run')
  if (filter === 'kraft') return t.includes('strength')
  return false
}

function typeIcon(type: string | null): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('swim')) return '🏊'
  if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) return '🚴'
  if (t.includes('run')) return '🏃'
  if (t.includes('strength')) return '💪'
  return '🏋'
}

function typeLabel(type: string | null): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('open_water') || t.includes('openwater')) return 'Freiwasserschwimmen'
  if (t.includes('swim')) return 'Schwimmen'
  if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) return 'Radfahren'
  if (t.includes('trail')) return 'Trailrunning'
  if (t.includes('run')) return 'Laufen'
  if (t.includes('strength')) return 'Krafttraining'
  return type ?? 'Training'
}

function fmtDuration(min: number | null): string {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

export function TriathlonHistory() {
  const [activities, setActivities] = useState<GarminActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('alle')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/training/summary?days=30')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.activities)) setActivities(data.activities)
      })
      .catch((e) => console.error('[TriathlonHistory] error:', e))
      .finally(() => setLoading(false))
  }, [])

  const filtered = activities.filter((a) => matchesFilter(a.type, filter))

  return (
    <Panel>
      <div className="panel-label">AKTIVITÄTEN — 30 TAGE</div>

      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '5px',
              border: `1px solid ${filter === f.value ? 'var(--accent)' : 'var(--line-strong)'}`,
              background:
                filter === f.value ? '#F3E0D5' : 'var(--line)',
              color: filter === f.value ? 'var(--accent)' : 'var(--ink-3)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)' }}>Lädt...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)' }}>Keine Aktivitäten</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {filtered.map((activity) => {
          const isExpanded = expandedId === activity.id
          return (
            <div
              key={activity.id}
              onClick={() => setExpandedId(isExpanded ? null : activity.id)}
              style={{
                padding: '0.5rem 0.625rem',
                borderRadius: '6px',
                background: isExpanded ? 'var(--line)' : 'var(--line)',
                border: `1px solid ${isExpanded ? 'var(--line-strong)' : 'var(--line)'}`,
                cursor: 'pointer',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>
                    {typeIcon(activity.type)}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-1)' }}>
                      {activity.name || typeLabel(activity.type)}
                    </div>
                    <div
                      style={{ fontSize: '0.65rem', color: 'var(--ink-3)', marginTop: '0.1rem' }}
                    >
                      {fmtDate(activity.date)}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.75rem',
                      color: 'var(--ink-1)',
                    }}
                  >
                    {fmtDuration(activity.duration_min)}
                  </div>
                  {activity.distance_km != null && (
                    <div
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.65rem',
                        color: 'var(--ink-3)',
                      }}
                    >
                      {activity.distance_km.toFixed(1)} km
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div
                  style={{
                    marginTop: '0.625rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--line)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '0.5rem',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    ['Ø HR', activity.avg_hr ? `${activity.avg_hr} bpm` : '—'],
                    ['Max HR', activity.max_hr ? `${activity.max_hr} bpm` : '—'],
                    ['Kalorien', activity.calories ? `${activity.calories} kcal` : '—'],
                    ['Höhenmeter', activity.elevation_m ? `${activity.elevation_m} m` : '—'],
                    ['Ø Pace', activity.avg_pace ?? '—'],
                    ['Distanz', activity.distance_km ? `${activity.distance_km.toFixed(2)} km` : '—'],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--ink-3)' }}>{label}</div>
                      <div
                        style={{
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: '0.72rem',
                          color: 'var(--ink-1)',
                          marginTop: '0.1rem',
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

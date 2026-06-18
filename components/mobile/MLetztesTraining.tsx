'use client'

import { useEffect, useState } from 'react'
import { MCard } from './MCard'
import type { GarminActivity } from '@/lib/types'

const SPORT_LABELS: Record<string, string> = {
  running: 'Laufen', trail_running: 'Trail', cycling: 'Radfahren',
  indoor_cycling: 'Indoor Rad', virtual_ride: 'Indoor Rad',
  swimming: 'Schwimmen', open_water_swimming: 'Freiwasser',
  lap_swimming: 'Bahnschwimmen', strength_training: 'Krafttraining',
  walking: 'Gehen', hiking: 'Wandern', multi_sport: 'Triathlon',
}
const SPORT_COLOR: Record<string, string> = {
  running: 'var(--sport-run)', trail_running: 'var(--sport-run)',
  cycling: 'var(--sport-bike)', indoor_cycling: 'var(--sport-bike)',
  virtual_ride: 'var(--sport-bike)',
  swimming: 'var(--sport-swim)', open_water_swimming: 'var(--sport-swim)',
  lap_swimming: 'var(--sport-swim)', strength_training: 'var(--sport-strength)',
  multi_sport: 'var(--accent)',
}
const NO_GPS_TYPES = new Set(['indoor_cycling', 'virtual_ride', 'strength_training', 'lap_swimming'])

function fmtDur(min: number | null): string {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`
}

function sportLabel(type: string | null) {
  return SPORT_LABELS[type ?? ''] ?? (type ?? 'Aktivität').replace(/_/g, ' ')
}
function sportColor(type: string | null) {
  return SPORT_COLOR[type ?? ''] ?? 'var(--ink-3)'
}

// Renders GPS polyline as an SVG track. Preserves aspect ratio, adds start/end
// dots. Background is kept dark so the accent-coloured line pops on mobile.
function RouteMap({ points }: { points: Array<{ lat: number; lon: number }> }) {
  if (points.length < 2) return null

  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLon = Math.min(...lons), maxLon = Math.max(...lons)

  const W = 300, H = 180, PAD = 16
  const latRange = maxLat - minLat || 0.001
  const lonRange = maxLon - minLon || 0.001

  // Fit inside padded box while keeping the geographic aspect ratio
  let drawW = W - 2 * PAD, drawH = H - 2 * PAD
  const aspect = lonRange / latRange
  if (aspect > drawW / drawH) {
    drawH = drawW / aspect
  } else {
    drawW = drawH * aspect
  }
  const offX = (W - drawW) / 2
  const offY = (H - drawH) / 2

  const toX = (lon: number) => offX + ((lon - minLon) / lonRange) * drawW
  const toY = (lat: number) => offY + (1 - (lat - minLat) / latRange) * drawH

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.lon).toFixed(1)},${toY(p.lat).toFixed(1)}`)
    .join(' ')

  const start = points[0]
  const end = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', borderRadius: 10, background: '#17120d', display: 'block', marginTop: 4 }}
    >
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.92" />
      <circle cx={toX(start.lon)} cy={toY(start.lat)} r="4.5" fill="#5bbd72" />
      <circle cx={toX(end.lon)} cy={toY(end.lat)} r="4.5" fill="var(--accent)" />
    </svg>
  )
}

function SyncBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={loading}
      style={{
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: '5px 10px',
        cursor: loading ? 'default' : 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.64rem',
        background: 'transparent',
        color: 'var(--ink-2)',
        opacity: loading ? 0.4 : 1,
        flexShrink: 0,
        letterSpacing: '0.04em',
      }}
    >
      {loading ? '…' : '↻ Sync'}
    </button>
  )
}

export function MLetztesTraining() {
  const [activity, setActivity] = useState<GarminActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [routePoints, setRoutePoints] = useState<Array<{ lat: number; lon: number }> | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

  useEffect(() => {
    fetch('/api/garmin/last-activity')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j) setActivity(j.activity ?? null) })
      .catch((e) => console.error('[MLetztesTraining] load:', e))
      .finally(() => setLoading(false))
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/garmin/sync-latest', { method: 'POST' })
      if (res.ok) {
        const j = await res.json()
        if (j.activity) {
          setActivity(j.activity)
          // Reset route so it reloads for the potentially new activity
          setRoutePoints(null)
        }
      }
    } catch (e) {
      console.error('[MLetztesTraining] sync:', e)
    } finally {
      setSyncing(false)
    }
  }

  const handleExpand = async () => {
    const next = !expanded
    setExpanded(next)

    if (next && routePoints === null && activity?.activity_id) {
      if (NO_GPS_TYPES.has(activity.type ?? '')) {
        setRoutePoints([])
        return
      }
      setRouteLoading(true)
      try {
        const res = await fetch(`/api/garmin/activity-route/${activity.activity_id}`)
        const j = res.ok ? await res.json() : { points: [] }
        setRoutePoints(j.points ?? [])
      } catch (e) {
        console.error('[MLetztesTraining] route:', e)
        setRoutePoints([])
      } finally {
        setRouteLoading(false)
      }
    }
  }

  if (loading) {
    return (
      <MCard label="Letzte Aktivität">
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Lädt…</div>
      </MCard>
    )
  }

  if (!activity) {
    return (
      <MCard label="Letzte Aktivität">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Keine Aktivität in DB</div>
          <SyncBtn loading={syncing} onClick={handleSync} />
        </div>
      </MCard>
    )
  }

  const dateLabel = new Date(activity.date + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  const metrics: [string, string][] = ([
    activity.distance_km != null ? ['Distanz', `${activity.distance_km} km`] : null,
    activity.duration_min != null ? ['Dauer', fmtDur(activity.duration_min)] : null,
    activity.avg_hr != null ? ['Ø HF', `${activity.avg_hr} bpm`] : null,
    activity.max_hr != null ? ['Max HF', `${activity.max_hr} bpm`] : null,
    activity.calories != null ? ['Kalorien', `${activity.calories} kcal`] : null,
    activity.elevation_m != null ? ['Höhenmeter', `+${activity.elevation_m} m`] : null,
    activity.avg_pace != null ? ['Ø Tempo', activity.avg_pace] : null,
    activity.avg_power != null ? ['Ø Watt', `${activity.avg_power} W`] : null,
    activity.norm_power != null ? ['NP', `${activity.norm_power} W`] : null,
  ] as ([string, string] | null)[]).filter((x): x is [string, string] => x !== null)

  return (
    <MCard label="Letzte Aktivität">
      {/* Summary row — always visible, click to expand */}
      <div
        onClick={handleExpand}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: sportColor(activity.type), flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.92rem', color: 'var(--ink-1)', fontWeight: 600 }}>
            {sportLabel(activity.type)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-3)', marginTop: 1 }}>
            {dateLabel}
            {activity.distance_km != null ? ` · ${activity.distance_km} km` : ''}
            {activity.duration_min != null ? ` · ${fmtDur(activity.duration_min)}` : ''}
          </div>
        </div>
        <SyncBtn loading={syncing} onClick={() => { void handleSync() }} />
        <span
          style={{
            color: 'var(--ink-3)', fontSize: '0.75rem',
            transition: 'transform .15s',
            transform: expanded ? 'rotate(180deg)' : 'none',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </div>

      {/* Detail section */}
      {expanded && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activity.name && (
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-2)', fontStyle: 'italic' }}>
              {activity.name}
            </div>
          )}

          {metrics.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
              {metrics.map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--ink-3)' }}>{l}</span>
                  <span style={{ color: 'var(--ink-1)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Route */}
          {routeLoading && (
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)', textAlign: 'center', padding: '16px 0' }}>
              Strecke lädt…
            </div>
          )}
          {!routeLoading && routePoints && routePoints.length > 1 && (
            <RouteMap points={routePoints} />
          )}
          {!routeLoading && routePoints !== null && routePoints.length <= 1 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)', textAlign: 'center', padding: '6px 0' }}>
              Keine GPS-Strecke
            </div>
          )}
        </div>
      )}
    </MCard>
  )
}

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

function RouteMap({ points }: { points: Array<{ lat: number; lon: number }> }) {
  if (points.length < 2) return null
  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLon = Math.min(...lons), maxLon = Math.max(...lons)
  const W = 300, H = 180, PAD = 16
  const latRange = maxLat - minLat || 0.001
  const lonRange = maxLon - minLon || 0.001
  let drawW = W - 2 * PAD, drawH = H - 2 * PAD
  const aspect = lonRange / latRange
  if (aspect > drawW / drawH) drawH = drawW / aspect
  else drawW = drawH * aspect
  const offX = (W - drawW) / 2
  const offY = (H - drawH) / 2
  const toX = (lon: number) => offX + ((lon - minLon) / lonRange) * drawW
  const toY = (lat: number) => offY + (1 - (lat - minLat) / latRange) * drawH
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.lon).toFixed(1)},${toY(p.lat).toFixed(1)}`).join(' ')
  const start = points[0], end = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', borderRadius: 10, background: '#17120d', display: 'block', marginTop: 4 }}>
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
        border: '1px solid var(--line)', borderRadius: 8, padding: '5px 10px',
        cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font-mono)',
        fontSize: '0.64rem', background: 'transparent', color: 'var(--ink-2)',
        opacity: loading ? 0.4 : 1, flexShrink: 0, letterSpacing: '0.04em',
      }}
    >
      {loading ? '…' : '↻ Sync'}
    </button>
  )
}

type RouteCache = Record<number, Array<{ lat: number; lon: number }>>

export function MLetztesTraining() {
  const [activities, setActivities] = useState<GarminActivity[]>([])
  const [date, setDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [routeCache, setRouteCache] = useState<RouteCache>({})
  const [routeLoading, setRouteLoading] = useState<number | null>(null)
  const [feedbackMap, setFeedbackMap] = useState<Record<number, string>>({})
  const [feedbackLoading, setFeedbackLoading] = useState<number | null>(null)

  const loadFeedback = async (activityId: number) => {
    if (feedbackMap[activityId] || feedbackLoading === activityId) return
    setFeedbackLoading(activityId)
    try {
      const r = await fetch(`/api/garmin/feedback?activityId=${activityId}`)
      const d = await r.json()
      setFeedbackMap(prev => ({ ...prev, [activityId]: d.feedback ?? '—' }))
    } catch {
      setFeedbackMap(prev => ({ ...prev, [activityId]: 'Feedback konnte nicht geladen werden.' }))
    } finally {
      setFeedbackLoading(null)
    }
  }

  useEffect(() => {
    fetch('/api/garmin/last-activity')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (j) {
          setActivities(j.activities ?? [])
          setDate(j.date ?? null)
        }
      })
      .catch((e) => console.error('[MLetztesTraining] load:', e))
      .finally(() => setLoading(false))
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/garmin/sync-latest', { method: 'POST' })
      if (res.ok) {
        const j = await res.json()
        if (j.activities) {
          setActivities(j.activities)
          setDate(j.date ?? null)
          setRouteCache({})
          // Signal MNextTraining to refresh its done-dates
          window.dispatchEvent(new Event('garmin-synced'))
        }
      }
    } catch (e) {
      console.error('[MLetztesTraining] sync:', e)
    } finally {
      setSyncing(false)
    }
  }

  const handleToggle = async (activityId: number, type: string | null) => {
    const next = expandedId === activityId ? null : activityId
    setExpandedId(next)
    if (next && !(activityId in routeCache)) {
      if (NO_GPS_TYPES.has(type ?? '')) {
        setRouteCache((prev) => ({ ...prev, [activityId]: [] }))
        return
      }
      setRouteLoading(activityId)
      try {
        const res = await fetch(`/api/garmin/activity-route/${activityId}`)
        const j = res.ok ? await res.json() : { points: [] }
        setRouteCache((prev) => ({ ...prev, [activityId]: j.points ?? [] }))
      } catch (e) {
        console.error('[MLetztesTraining] route:', e)
        setRouteCache((prev) => ({ ...prev, [activityId]: [] }))
      } finally {
        setRouteLoading(null)
      }
    }
  }

  const dateLabel = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
    : null

  if (loading) {
    return (
      <MCard label="Letzte Aktivität">
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Lädt…</div>
      </MCard>
    )
  }

  return (
    <MCard label="Letzte Aktivität">
      {/* Top row: date + sync button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activities.length > 0 ? 10 : 0 }}>
        {dateLabel ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
            {dateLabel}
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Keine Aktivität in DB</div>
        )}
        <SyncBtn loading={syncing} onClick={() => { void handleSync() }} />
      </div>

      {/* Activity list */}
      {activities.length === 0 && !loading && (
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>—</div>
      )}

      {activities.map((activity) => {
        const isExpanded = expandedId === activity.activity_id
        const color = sportColor(activity.type)
        const points = activity.activity_id != null ? (routeCache[activity.activity_id] ?? null) : null
        const isRouteLoading = routeLoading === activity.activity_id

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
          <div key={activity.id} style={{ marginBottom: 4 }}>
            {/* Summary row */}
            <div
              onClick={() => activity.activity_id != null && handleToggle(activity.activity_id, activity.type)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44,
                padding: '6px 0', borderTop: '1px solid var(--line)' }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.92rem', color: 'var(--ink-1)', fontWeight: 600 }}>
                  {sportLabel(activity.type)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-3)', marginTop: 1 }}>
                  {activity.distance_km != null ? `${activity.distance_km} km` : ''}
                  {activity.distance_km != null && activity.duration_min != null ? ' · ' : ''}
                  {activity.duration_min != null ? fmtDur(activity.duration_min) : ''}
                </div>
              </div>
              <span style={{ color: 'var(--ink-3)', fontSize: '0.75rem', transition: 'transform .15s',
                transform: isExpanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▾</span>
            </div>

            {/* Detail section */}
            {isExpanded && (
              <div style={{ paddingBottom: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                {isRouteLoading && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)', textAlign: 'center', padding: '16px 0' }}>
                    Strecke lädt…
                  </div>
                )}
                {!isRouteLoading && points && points.length > 1 && <RouteMap points={points} />}
                {!isRouteLoading && points !== null && points.length <= 1 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)', textAlign: 'center', padding: '6px 0' }}>
                    Keine GPS-Strecke
                  </div>
                )}

                {/* Coach-Feedback */}
                {activity.activity_id != null && (() => {
                  const fb = feedbackMap[activity.activity_id]
                  const isFbLoading = feedbackLoading === activity.activity_id
                  if (fb) return (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 6 }}>
                        COACH-FEEDBACK
                      </div>
                      <div style={{
                        fontSize: '0.82rem', color: 'var(--ink-1)', lineHeight: 1.65,
                        borderLeft: '2px solid var(--accent)', paddingLeft: 10,
                      }}>
                        {fb}
                      </div>
                    </div>
                  )
                  return (
                    <button
                      onClick={() => void loadFeedback(activity.activity_id!)}
                      disabled={isFbLoading}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '10px 0',
                        background: 'transparent', border: 'none',
                        borderTop: '1px solid var(--line)',
                        cursor: isFbLoading ? 'default' : 'pointer',
                        color: isFbLoading ? 'var(--ink-3)' : 'var(--accent)',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.06em' }}>
                        {isFbLoading ? 'ANALYSIERE ···' : '💬  COACH-FEEDBACK'}
                      </span>
                      {!isFbLoading && <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>→</span>}
                    </button>
                  )
                })()}
              </div>
            )}
          </div>
        )
      })}
    </MCard>
  )
}

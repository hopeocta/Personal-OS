'use client'
import { useEffect, useState, useCallback } from 'react'

const SPORT_ICON: Record<string, string> = {
  Run: '🏃', Bike: '🚴', Swim: '🏊', Strength: '🏋',
  Brick: '🔱', Duathlon: '🔱', Walk: '🚶', Other: '⚡',
}
const SPORT_COLOR: Record<string, string> = {
  Run: '#4CAF82', Bike: '#E8A44A', Swim: '#5B9FD4',
  Strength: '#9C6BE0', Brick: '#E06B9C', Walk: '#8BA88B', Other: '#888',
}

type Activity = {
  id: number
  workout_day: string
  sport: string
  title: string | null
  duration_actual_h: number | null
  distance_actual_km: number | null
  tss_actual: number | null
  hr_avg: number | null
  hr_max: number | null
  calories: number | null
  elevation_gain_m: number | null
}

type Day = [string, Activity[]]

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

function fmtDate(d: string) {
  const dt = new Date(d + 'T12:00:00')
  const today = new Date(); today.setHours(12,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1)
  if (dt.toDateString() === today.toDateString()) return 'Heute'
  if (dt.toDateString() === yesterday.toDateString()) return 'Gestern'
  return `${WOCHENTAGE[dt.getDay()]}, ${dt.getDate()}. ${MONATE[dt.getMonth()]}`
}

function fmtDur(h: number | null) {
  if (!h) return null
  const total = Math.round(h * 60)
  return total >= 60 ? `${Math.floor(total/60)}h ${total%60}min` : `${total}min`
}

function fmtDist(km: number | null) {
  if (!km) return null
  return km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km*1000)} m`
}

export default function MarkusActivities({ personId }: { personId: string }) {
  const [days, setDays] = useState<Day[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(() => {
    fetch(`/api/p/${personId}/activities`)
      .then(r => r.json())
      .then(d => setDays(d.days ?? []))
      .catch(() => {})
  }, [personId])

  useEffect(() => { load() }, [load])

  async function sync() {
    setSyncing(true)
    try {
      const res = await fetch(`/api/p/${personId}/sync`, { method: 'POST' })
      const data = await res.json()
      setLastSync(`${data.workouts} neue Aktivitäten`)
      load()
    } catch {
      setLastSync('Fehler beim Sync')
    } finally {
      setSyncing(false)
    }
  }

  if (days.length === 0 && !syncing) return null

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#7A6E5E', textTransform: 'uppercase', letterSpacing: 1 }}>
          Zuletzt absolviert
        </span>
        <button
          onClick={sync}
          disabled={syncing}
          style={{
            background: syncing ? 'rgba(255,255,255,0.06)' : 'rgba(92,160,180,0.15)',
            border: '1px solid rgba(92,160,180,0.3)',
            borderRadius: 8, padding: '4px 10px',
            fontSize: 12, color: '#5CA0B4', cursor: syncing ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
          {syncing ? 'Sync…' : 'Sync'}
        </button>
      </div>
      {lastSync && (
        <div style={{ fontSize: 11, color: '#7A8E9E', marginBottom: 8 }}>{lastSync}</div>
      )}

      {/* Tage */}
      {days.map(([date, acts]) => (
        <div key={date} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 600 }}>
            {fmtDate(date)}
          </div>
          {acts.map(act => {
            const color = SPORT_COLOR[act.sport] ?? '#888'
            const icon = SPORT_ICON[act.sport] ?? '⚡'
            const isOpen = expanded === act.id
            return (
              <div
                key={act.id}
                onClick={() => setExpanded(isOpen ? null : act.id)}
                style={{
                  background: `${color}11`,
                  border: `1px solid ${color}33`,
                  borderRadius: 10, padding: '10px 12px',
                  marginBottom: 6, cursor: 'pointer',
                }}
              >
                {/* Zeile 1 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#2A2A2A' }}>
                    {act.title || act.sport}
                  </span>
                  <span style={{ fontSize: 11, color }}>✓</span>
                </div>
                {/* Zeile 2: Chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {fmtDur(act.duration_actual_h) && (
                    <span style={{ fontSize: 11, color: '#666', background: 'rgba(0,0,0,0.05)', borderRadius: 5, padding: '2px 7px' }}>
                      ⏱ {fmtDur(act.duration_actual_h)}
                    </span>
                  )}
                  {fmtDist(act.distance_actual_km) && (
                    <span style={{ fontSize: 11, color: '#666', background: 'rgba(0,0,0,0.05)', borderRadius: 5, padding: '2px 7px' }}>
                      📍 {fmtDist(act.distance_actual_km)}
                    </span>
                  )}
                  {act.tss_actual && (
                    <span style={{ fontSize: 11, color: '#666', background: 'rgba(0,0,0,0.05)', borderRadius: 5, padding: '2px 7px' }}>
                      TSS {Math.round(act.tss_actual)}
                    </span>
                  )}
                  {act.hr_avg && (
                    <span style={{ fontSize: 11, color: '#666', background: 'rgba(0,0,0,0.05)', borderRadius: 5, padding: '2px 7px' }}>
                      ♥ {act.hr_avg} bpm
                    </span>
                  )}
                </div>
                {/* Detail */}
                {isOpen && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {act.hr_max && <span style={{ fontSize: 11, color: '#888' }}>HFmax {act.hr_max} bpm</span>}
                    {act.elevation_gain_m && <span style={{ fontSize: 11, color: '#888' }}>↗ {Math.round(act.elevation_gain_m)} m</span>}
                    {act.calories && <span style={{ fontSize: 11, color: '#888' }}>🔥 {act.calories} kcal</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

'use client'
import { useEffect, useState, useCallback } from 'react'

const SURFACE = '#111E30'
const PARCH   = '#D8CFC0'
const FOG     = '#7A8FA5'
const MIST    = '#3D5265'
const BRASS   = '#C4973A'
const MONO    = "'Space Mono', monospace"
const SERIF   = "'IM Fell English SC', Georgia, serif"

const SPORT_COL: Record<string, string> = {
  Run: '#3D9B78', Bike: '#C4973A', Swim: '#5B9FD4',
  Strength: '#7F77DD', Brick: '#C4973A', Walk: '#7A8FA5', Other: '#3D5265',
}
const SPORT_LABEL: Record<string, string> = {
  Run: 'Laufen', Bike: 'Rad', Swim: 'Schwimmen',
  Strength: 'Kraft', Brick: 'Brick', Walk: 'Gehen', Other: 'Sonstiges',
}

type Activity = {
  id: number; workout_day: string; sport: string; title: string | null
  duration_actual_h: number | null; distance_actual_km: number | null
  tss_actual: number | null; hr_avg: number | null; hr_max: number | null
  calories: number | null; elevation_gain_m: number | null
}
type Day = [string, Activity[]]

const WD = ['So','Mo','Di','Mi','Do','Fr','Sa']
const MO = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

function fmtDate(d: string) {
  const dt = new Date(d + 'T12:00:00')
  const td = new Date(); td.setHours(12,0,0,0)
  const yd = new Date(td); yd.setDate(yd.getDate()-1)
  if (dt.toDateString() === td.toDateString()) return 'Heute'
  if (dt.toDateString() === yd.toDateString()) return 'Gestern'
  return `${WD[dt.getDay()]}, ${dt.getDate()}. ${MO[dt.getMonth()]}`
}

function fmtDur(h: number | null) {
  if (!h) return null
  const m = Math.round(h * 60)
  return m >= 60 ? `${Math.floor(m/60)}h${m%60 > 0 ? ` ${m%60}'` : ''}` : `${m}'`
}

function fmtDist(km: number | null) {
  if (!km) return null
  return km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km*1000)} m`
}

export default function MarkusActivities({ personId }: { personId: string }) {
  const [days, setDays]       = useState<Day[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(() => {
    fetch(`/api/p/${personId}/activities`)
      .then(r => r.json()).then(d => setDays(d.days ?? [])).catch(() => {})
  }, [personId])

  useEffect(() => { load() }, [load])

  async function sync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const r = await fetch(`/api/p/${personId}/sync`, { method: 'POST' })
      const d = await r.json()
      setSyncMsg(d.workouts > 0 ? `${d.workouts} neue Aktivität${d.workouts !== 1 ? 'en' : ''}` : 'Nichts Neues')
      load()
    } catch { setSyncMsg('Verbindungsfehler') }
    finally { setSyncing(false) }
  }

  if (days.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>

      {/* Header-Zeile */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MIST, letterSpacing: '0.15em' }}>
          AKTIVITÄTENLOG
        </span>
        <button onClick={sync} disabled={syncing} style={{
          fontFamily: MONO, fontSize: 10,
          background: 'transparent',
          border: `1px solid rgba(196,151,58,0.3)`,
          borderRadius: 6, padding: '4px 10px',
          color: syncing ? MIST : BRASS,
          cursor: syncing ? 'default' : 'pointer',
          letterSpacing: '0.08em',
        }}>
          {syncing ? '···' : '↻ SYNC'}
        </button>
      </div>

      {syncMsg && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: FOG, marginBottom: 8 }}>{syncMsg}</div>
      )}

      {/* Tage */}
      {days.map(([date, acts]) => (
        <div key={date} style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: SERIF, fontSize: 12, color: MIST,
            marginBottom: 6, letterSpacing: '0.06em',
          }}>
            {fmtDate(date)}
          </div>
          {acts.map(act => {
            const col   = SPORT_COL[act.sport] ?? FOG
            const label = SPORT_LABEL[act.sport] ?? act.sport
            const isOpen = expanded === act.id
            return (
              <div key={act.id} onClick={() => setExpanded(isOpen ? null : act.id)}
                style={{
                  background: SURFACE,
                  border: `1px solid rgba(255,255,255,0.05)`,
                  borderLeft: `3px solid ${col}`,
                  borderRadius: '0 8px 8px 0',
                  padding: '10px 12px',
                  marginBottom: 6, cursor: 'pointer',
                }}>

                {/* Zeile 1 */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: col, letterSpacing: '0.1em', flexShrink: 0 }}>
                    {label.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: SERIF, fontSize: 14, color: PARCH, flex: 1, lineHeight: 1.3 }}>
                    {act.title || label}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: col }}>✓</span>
                </div>

                {/* Chips */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {fmtDur(act.duration_actual_h) && (
                    <span style={{ fontFamily: MONO, fontSize: 10, color: FOG }}>{fmtDur(act.duration_actual_h)}</span>
                  )}
                  {fmtDist(act.distance_actual_km) && (
                    <span style={{ fontFamily: MONO, fontSize: 10, color: FOG }}>{fmtDist(act.distance_actual_km)}</span>
                  )}
                  {act.tss_actual && (
                    <span style={{ fontFamily: MONO, fontSize: 10, color: FOG }}>TSS {Math.round(act.tss_actual)}</span>
                  )}
                  {act.hr_avg && (
                    <span style={{ fontFamily: MONO, fontSize: 10, color: FOG }}>{act.hr_avg} bpm</span>
                  )}
                </div>

                {/* Detail-Klappe */}
                {isOpen && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', gap: 16, flexWrap: 'wrap',
                  }}>
                    {act.hr_max && <span style={{ fontFamily: MONO, fontSize: 10, color: MIST }}>max {act.hr_max} bpm</span>}
                    {act.elevation_gain_m && <span style={{ fontFamily: MONO, fontSize: 10, color: MIST }}>↗ {Math.round(act.elevation_gain_m)} m</span>}
                    {act.calories && <span style={{ fontFamily: MONO, fontSize: 10, color: MIST }}>{act.calories} kcal</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

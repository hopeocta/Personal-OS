'use client'
import { useEffect, useState } from 'react'

const BRASS = '#C4973A'
const SEA   = '#3D9B78'
const RUST  = '#9B4040'
const SURF  = '#111E30'
const MIST  = '#3D5265'
const FOG   = '#7A8FA5'
const PARCH = '#D8CFC0'
const MONO  = "'Space Mono', monospace"

const SPORT_ICON: Record<string, string> = {
  running: '🏃', cycling: '🚴', swimming: '🏊', strength: '🏋', brick: '⚡',
}
const SPORT_DE: Record<string, string> = {
  running: 'Laufen', cycling: 'Rad', swimming: 'Schwimmen', strength: 'Kraft', brick: 'Brick',
}

type SportRow = { sport: string; planned: number; done: number; totalMin: number }
type Overview = {
  bySport: SportRow[]
  totalPlanned: number
  totalDone: number
  whoop: number | null
  whoopHrv: number | null
  whoopDate: string | null
  lastSyncDate: string | null
  syncAgeDays: number | null
  syncOnline: boolean
}

function whoopColor(s: number | null) {
  if (s === null) return FOG
  return s >= 67 ? SEA : s >= 34 ? BRASS : RUST
}
function whoopLabel(s: number | null) {
  if (s === null) return '—'
  return s >= 67 ? 'Erholt' : s >= 34 ? 'OK' : 'Müde'
}
function optSignal(whoop: number | null, done: number, planned: number) {
  const behind = planned > 0 && done < planned * 0.5
  if (whoop === null) return { label: 'Optionals nach Gefühl', color: BRASS }
  if (whoop >= 67 && !behind) return { label: 'Optionals freigegeben', color: SEA }
  if (whoop >= 34)            return { label: 'Optionals nach Gefühl', color: BRASS }
  return                             { label: 'Optionals streichen',   color: RUST }
}

export default function MarkusWochenpensum({ personId }: { personId: string }) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/p/${personId}/week-overview`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [personId])

  if (loading) return null
  if (!data) return null

  const sig = optSignal(data.whoop, data.totalDone, data.totalPlanned)
  const compliancePct = data.totalPlanned > 0
    ? Math.round(data.totalDone / data.totalPlanned * 100)
    : null

  return (
    <div style={{
      background: SURF,
      border: `1px solid rgba(196,151,58,0.18)`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 4,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MIST, letterSpacing: '0.15em' }}>
          DIESE WOCHE
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', color: sig.color }}>
          {sig.label}
        </span>
      </div>

      {/* Sport-Kacheln */}
      {data.bySport.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(data.bySport.length, 4)}, 1fr)`, gap: 6, marginBottom: 10 }}>
          {data.bySport.map(s => {
            const allDone = s.done >= s.planned
            const noneDone = s.done === 0
            const col = allDone ? SEA : noneDone ? RUST : BRASS
            const h = Math.floor(s.totalMin / 60)
            const m = s.totalMin % 60
            const durStr = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
            return (
              <div key={s.sport} style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${allDone ? 'rgba(61,155,120,0.3)' : 'rgba(255,255,255,0.04)'}`,
                borderRadius: 8, padding: '8px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, marginBottom: 3, lineHeight: 1 }}>
                  {SPORT_ICON[s.sport] ?? '•'}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: MIST, letterSpacing: '0.1em', marginBottom: 4 }}>
                  {SPORT_DE[s.sport] ?? s.sport}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 14, color: col, lineHeight: 1, marginBottom: 2 }}>
                  {s.done}/{s.planned}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: FOG }}>{durStr}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ fontFamily: MONO, fontSize: 10, color: FOG, marginBottom: 10 }}>
          Keine Pflichteinheiten bis heute
        </div>
      )}

      {/* WHOOP + Gesamt */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: data.totalPlanned > 0 ? 8 : 0 }}>
        {/* WHOOP Block */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px', flex: 1,
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: MIST, letterSpacing: '0.1em', marginBottom: 3 }}>WHOOP</div>
            <div style={{ fontFamily: MONO, fontSize: 18, color: whoopColor(data.whoop), lineHeight: 1 }}>
              {data.whoop ?? '—'}
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: whoopColor(data.whoop), alignSelf: 'flex-end', paddingBottom: 1 }}>
            {whoopLabel(data.whoop)}
            {data.whoopHrv ? ` · ${data.whoopHrv}ms HRV` : ''}
          </div>
        </div>

        {/* Gesamt */}
        {data.totalPlanned > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 10px',
            border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center', minWidth: 64,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 7, color: MIST, letterSpacing: '0.1em', marginBottom: 3 }}>GESAMT</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: compliancePct !== null && compliancePct >= 80 ? SEA : BRASS, lineHeight: 1 }}>
              {data.totalDone}/{data.totalPlanned}
            </div>
            {compliancePct !== null && (
              <div style={{ fontFamily: MONO, fontSize: 8, color: FOG, marginTop: 2 }}>{compliancePct}%</div>
            )}
          </div>
        )}
      </div>

      {/* Fortschrittsbalken */}
      {data.totalPlanned > 0 && compliancePct !== null && (
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${compliancePct}%`,
            background: compliancePct >= 80 ? SEA : compliancePct >= 50 ? BRASS : RUST,
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {/* TP-Sync-Status */}
      {!data.syncOnline && data.syncAgeDays !== null && (
        <div style={{
          marginTop: 8, fontFamily: MONO, fontSize: 8, letterSpacing: '0.06em',
          color: RUST, background: 'rgba(155,64,64,0.08)',
          borderRadius: 6, padding: '4px 8px',
        }}>
          ⚠ TP OFFLINE · letzter Sync {data.lastSyncDate} ({data.syncAgeDays}d)
        </div>
      )}
    </div>
  )
}

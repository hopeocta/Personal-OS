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

type WeekRow = {
  week: string
  tss_plan: number
  tss_ist: number
  planned: number
  done: number
  compliance: number | null
}
type RecovData = {
  today: { whoop_recovery_score: number | null } | null
  baselines: { whoop_avg_7d: number | null }
}

function whoopColor(s: number | null) {
  if (s === null) return FOG
  return s >= 67 ? SEA : s >= 34 ? BRASS : RUST
}
function optionalSignal(whoop: number | null, tssIst: number, tssPlan: number): { label: string; color: string; bg: string } {
  if (whoop === null) return { label: 'Daten fehlen', color: FOG, bg: 'rgba(122,143,165,0.08)' }
  const underloaded = tssIst < tssPlan * 0.9
  if (whoop >= 67 && underloaded) return { label: 'Optionals freigegeben', color: SEA,  bg: 'rgba(61,155,120,0.1)' }
  if (whoop >= 34)               return { label: 'Optionals nach Gefühl', color: BRASS, bg: 'rgba(196,151,58,0.1)' }
  return                                 { label: 'Optionals streichen',   color: RUST,  bg: 'rgba(155,64,64,0.1)' }
}

function weekStartStr(): string {
  const now = new Date()
  const d = new Date(now)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

export default function MarkusWochenpensum({ personId }: { personId: string }) {
  const [week, setWeek]   = useState<WeekRow | null>(null)
  const [whoop, setWhoop] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const thisWk = weekStartStr()
    Promise.all([
      fetch(`/api/p/${personId}/progress?weeks=4`).then(r => r.json()),
      fetch(`/api/p/${personId}/recovery`).then(r => r.json()),
    ]).then(([prog, recov]: [{ weeks: WeekRow[] }, RecovData]) => {
      const w = (prog.weeks ?? []).find((r: WeekRow) => r.week === thisWk) ?? null
      setWeek(w)
      setWhoop(recov?.today?.whoop_recovery_score ?? null)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [personId])

  if (loading || !week) return null

  const tssIst  = week.tss_ist
  const tssPlan = week.tss_plan
  const pct     = tssPlan > 0 ? Math.min(100, Math.round(tssIst / tssPlan * 100)) : 0
  const sig     = optionalSignal(whoop, tssIst, tssPlan)

  return (
    <div style={{
      background: SURF,
      border: `1px solid rgba(196,151,58,0.18)`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 4,
    }}>
      {/* Header + Signal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MIST, letterSpacing: '0.15em' }}>
          DIESE WOCHE
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
          color: sig.color, background: sig.bg,
          padding: '3px 8px', borderRadius: 20,
        }}>
          {sig.label}
        </span>
      </div>

      {/* Metriken */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'TSS IST',  value: String(tssIst),  color: pct >= 80 ? SEA : pct >= 50 ? BRASS : RUST },
          { label: 'TSS PLAN', value: String(tssPlan), color: PARCH },
          { label: 'WHOOP',    value: whoop !== null ? String(whoop) : '—', color: whoopColor(whoop) },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 8,
            padding: '8px 10px', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: MIST, letterSpacing: '0.12em', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 18, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* TSS-Fortschrittsbalken */}
      {tssPlan > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: MIST }}>WOCHENLAST</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: pct >= 80 ? SEA : BRASS }}>{pct}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${pct}%`,
              background: pct >= 80 ? SEA : pct >= 50 ? BRASS : RUST,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: FOG, marginTop: 4 }}>
            {week.done}/{week.planned} Pflichteinheiten · {week.compliance ?? 0}% Compliance
          </div>
        </div>
      )}
    </div>
  )
}

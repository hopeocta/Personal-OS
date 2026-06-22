'use client'
import { useEffect, useState } from 'react'

type WellnessEntry = {
  date: string
  whoop_recovery_score: number | null
  hrv_ms: number | null
  resting_hr: number | null
  sleep_total_h: number | null
  sleep_deep_h: number | null
  sleep_rem_h: number | null
  sleep_light_h: number | null
  sleep_disturbances: number | null
  recovery_label: string | null
}
type RecoveryData = {
  today: WellnessEntry | null
  trend: WellnessEntry[]
  baselines: { hrv_baseline_30d: number | null; rhr_avg_7d: number | null; whoop_avg_7d: number | null }
}

const BRASS  = '#C4973A'
const SEA    = '#3D9B78'
const RUST   = '#9B4040'
const SURFACE = '#111E30'
const BORDER  = 'rgba(196,151,58,0.18)'
const PARCH  = '#D8CFC0'
const FOG    = '#7A8FA5'
const MIST   = '#3D5265'
const MONO   = "'Space Mono', monospace"
const SERIF  = "'IM Fell English SC', Georgia, serif"

function scoreColor(s: number | null) {
  if (s === null) return FOG
  return s >= 67 ? SEA : s >= 34 ? BRASS : RUST
}
function scoreLabel(s: number | null) {
  if (s === null) return '–'
  if (s >= 67) return 'Fit für die Überfahrt'
  if (s >= 34) return 'Moderat — Kurs halten'
  return 'Hafentag — Erholung'
}

function Ring({ score }: { score: number | null }) {
  const r = 42, circ = 2 * Math.PI * r
  const dash = score !== null ? (score / 100) * circ : 0
  const col = scoreColor(score)
  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8} />
      <circle cx={50} cy={50} r={r} fill="none" stroke={col} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      <text x={50} y={46} textAnchor="middle" fill={col}
        fontSize={20} fontWeight={700} fontFamily={MONO}>
        {score ?? '–'}
      </text>
      <text x={50} y={62} textAnchor="middle" fill={MIST} fontSize={9} fontFamily={MONO}>
        WHOOP
      </text>
    </svg>
  )
}

function HrvChip({ hrv, base }: { hrv: number | null; base: number | null }) {
  if (!hrv) return <span style={{ color: MIST }}>–</span>
  const diff = base ? Math.round(hrv - base) : null
  const col = diff === null ? FOG : diff >= 0 ? SEA : RUST
  return (
    <span style={{ color: col, fontFamily: MONO, fontSize: 12 }}>
      {Math.round(hrv)} ms
      {diff !== null && <span style={{ fontSize: 10, marginLeft: 4, color: FOG }}>{diff > 0 ? `+${diff}` : diff}</span>}
    </span>
  )
}

function SleepRow({ label, h, col }: { label: string; h: number | null; col: string }) {
  if (!h) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: MIST, width: 54 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
        <div style={{ width: `${Math.min(100, (h / 3) * 100)}%`, height: '100%', background: col, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: FOG, width: 28, textAlign: 'right' }}>{h.toFixed(1)}h</span>
    </div>
  )
}

const WOTAG = ['So','Mo','Di','Mi','Do','Fr','Sa']

export default function MarkusRecovery({ personId }: { personId: string }) {
  const [data, setData] = useState<RecoveryData | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/p/${personId}/recovery`).then(r => r.json()).then(setData).catch(() => {})
  }, [personId])

  if (!data?.today) return null
  const { today: d, trend, baselines: b } = data
  const score = d.whoop_recovery_score
  const col = scoreColor(score)

  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${col}`,
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 14,
      cursor: 'pointer',
    }} onClick={() => setOpen(o => !o)}>

      {/* Kopfzeile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ring score={score} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MIST, letterSpacing: '0.15em', marginBottom: 4 }}>
            ERHOLUNGSLOG · HEUTE
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 16, color: col, marginBottom: 8 }}>
            {scoreLabel(score)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: FOG }}>
              zzz {d.sleep_total_h ? `${d.sleep_total_h.toFixed(1)}h` : '–'}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: FOG }}>
              hrv <HrvChip hrv={d.hrv_ms} base={b.hrv_baseline_30d} />
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: FOG }}>
              rhr {d.resting_hr ?? '–'} bpm
            </span>
          </div>
        </div>
        <span style={{ color: MIST, fontSize: 12, fontFamily: MONO }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* Detail */}
      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MIST, letterSpacing: '0.15em', marginBottom: 10 }}>
            SCHLAFLOG
          </div>
          <SleepRow label="Tiefschlaf" h={d.sleep_deep_h} col="#534AB7" />
          <SleepRow label="REM" h={d.sleep_rem_h} col="#7F77DD" />
          <SleepRow label="Leicht" h={d.sleep_light_h} col={MIST} />
          {d.sleep_disturbances !== null && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: MIST, marginTop: 4 }}>
              {d.sleep_disturbances} wachphasen
            </div>
          )}

          {trend.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MIST, letterSpacing: '0.15em', marginBottom: 8 }}>
                7-TAGE-VERLAUF
              </div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 38 }}>
                {[...trend].reverse().map((w, i) => {
                  const s = w.whoop_recovery_score
                  const h = s !== null ? Math.max(5, (s / 100) * 34) : 3
                  const d = new Date(w.date + 'T12:00:00')
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: '100%', height: h, background: scoreColor(s), borderRadius: 2, opacity: 0.75 }} />
                      <span style={{ fontFamily: MONO, fontSize: 8, color: MIST }}>
                        {WOTAG[d.getDay()]}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                {[
                  ['Ø WHOOP', b.whoop_avg_7d],
                  ['Ø RHR', b.rhr_avg_7d ? `${b.rhr_avg_7d} bpm` : '–'],
                  ['HRV BASE', b.hrv_baseline_30d ? `${b.hrv_baseline_30d} ms` : '–'],
                ].map(([label, val]) => (
                  <div key={String(label)} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: MIST }}>{label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: FOG }}>{val ?? '–'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empfehlung */}
          <div style={{
            marginTop: 12, padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)',
            borderLeft: `2px solid ${col}`,
            borderRadius: '0 6px 6px 0',
            fontFamily: SERIF, fontSize: 13, color: FOG,
            lineHeight: 1.5,
          }}>
            {score !== null && score >= 67
              ? 'Optionale Einheiten freigegeben.'
              : score !== null && score >= 34
              ? 'Optionale Einheiten nur bei gutem Verlauf.'
              : 'Optionale Einheiten heute streichen.'}
          </div>
        </div>
      )}
    </div>
  )
}

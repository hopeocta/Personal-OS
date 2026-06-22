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
  baselines: {
    hrv_baseline_30d: number | null
    rhr_avg_7d: number | null
    whoop_avg_7d: number | null
  }
}

function scoreColor(score: number | null): string {
  if (score === null) return '#888'
  if (score >= 67) return '#22c55e'
  if (score >= 34) return '#f59e0b'
  return '#ef4444'
}

function scoreBg(score: number | null): string {
  if (score === null) return '#1a1a1a'
  if (score >= 67) return 'rgba(34,197,94,0.08)'
  if (score >= 34) return 'rgba(245,158,11,0.08)'
  return 'rgba(239,68,68,0.08)'
}

function scoreLabel(score: number | null): string {
  if (score === null) return '–'
  if (score >= 67) return 'Grün – Vollgas möglich'
  if (score >= 34) return 'Gelb – Moderat trainieren'
  return 'Rot – Erholung priorisieren'
}

function ScoreRing({ score }: { score: number | null }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const pct = score !== null ? score / 100 : 0
  const dash = pct * circ
  const color = scoreColor(score)
  return (
    <svg width={108} height={108} viewBox="0 0 108 108">
      <circle cx={54} cy={54} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
      <circle
        cx={54} cy={54} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 54 54)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={54} y={50} textAnchor="middle" fill={color} fontSize={22} fontWeight={700} fontFamily="monospace">
        {score ?? '–'}
      </text>
      <text x={54} y={66} textAnchor="middle" fill="#888" fontSize={10} fontFamily="system-ui">
        WHOOP
      </text>
    </svg>
  )
}

function HrvBar({ hrv, baseline }: { hrv: number | null; baseline: number | null }) {
  if (!hrv) return <span style={{ color: '#555' }}>–</span>
  const diff = baseline ? Math.round(hrv - baseline) : null
  const color = diff === null ? '#888' : diff >= 0 ? '#22c55e' : '#ef4444'
  return (
    <span style={{ color }}>
      {Math.round(hrv)} ms
      {diff !== null && (
        <span style={{ fontSize: 11, marginLeft: 4 }}>
          {diff >= 0 ? `+${diff}` : diff} vs Baseline
        </span>
      )}
    </span>
  )
}

function SleepBar({ label, hours, color }: { label: string; hours: number | null; color: string }) {
  if (!hours) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <span style={{ width: 60, fontSize: 11, color: '#888' }}>{label}</span>
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (hours / 3) * 100)}%`, background: color, height: '100%', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: '#aaa', width: 32, textAlign: 'right' }}>{hours.toFixed(1)}h</span>
    </div>
  )
}

export default function MarkusRecovery({ personId }: { personId: string }) {
  const [data, setData] = useState<RecoveryData | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/p/${personId}/recovery`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [personId])

  if (!data || !data.today) return null

  const { today, trend, baselines } = data
  const score = today.whoop_recovery_score
  const color = scoreColor(score)
  const bg = scoreBg(score)

  return (
    <div style={{
      background: bg,
      border: `1px solid ${color}33`,
      borderRadius: 16,
      padding: '16px 18px',
      marginBottom: 16,
      cursor: 'pointer',
    }} onClick={() => setOpen(o => !o)}>
      {/* Kopfzeile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <ScoreRing score={score} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>RECOVERY HEUTE</div>
          <div style={{ fontSize: 15, fontWeight: 600, color }}>
            {scoreLabel(score)}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>
              💤 {today.sleep_total_h ? `${today.sleep_total_h.toFixed(1)}h` : '–'}
            </span>
            <span style={{ fontSize: 12, color: '#aaa' }}>
              📉 HRV <HrvBar hrv={today.hrv_ms} baseline={baselines.hrv_baseline_30d} />
            </span>
            <span style={{ fontSize: 12, color: '#aaa' }}>
              ❤️ RHR {today.resting_hr ?? '–'} bpm
            </span>
          </div>
        </div>
        <span style={{ color: '#555', fontSize: 18 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Detail-Ansicht */}
      {open && (
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
          {/* Schlaf-Breakdown */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Schlaf</div>
            <SleepBar label="Tief" hours={today.sleep_deep_h} color="#6366f1" />
            <SleepBar label="REM" hours={today.sleep_rem_h} color="#8b5cf6" />
            <SleepBar label="Leicht" hours={today.sleep_light_h} color="#64748b" />
            {today.sleep_disturbances !== null && (
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                {today.sleep_disturbances} Wachphasen
              </div>
            )}
          </div>

          {/* 7-Tage WHOOP-Trend */}
          {trend.length > 1 && (
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                7-Tage-Trend
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 40 }}>
                {[...trend].reverse().map((w, i) => {
                  const s = w.whoop_recovery_score
                  const h = s !== null ? Math.max(6, (s / 100) * 36) : 4
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '100%', height: h,
                        background: scoreColor(s),
                        borderRadius: 2, opacity: 0.8,
                        transition: 'height 0.3s ease',
                      }} />
                      <span style={{ fontSize: 9, color: '#555' }}>
                        {new Date(w.date + 'T12:00:00').toLocaleDateString('de', { weekday: 'short' }).slice(0, 2)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#666' }}>
                <span>Ø WHOOP 7d: {baselines.whoop_avg_7d ?? '–'}</span>
                <span>Ø RHR 7d: {baselines.rhr_avg_7d ?? '–'} bpm</span>
                <span>HRV Baseline: {baselines.hrv_baseline_30d ?? '–'} ms</span>
              </div>
            </div>
          )}

          {/* Optionale Einheiten Empfehlung */}
          <div style={{
            marginTop: 12, padding: '8px 12px',
            background: 'rgba(255,255,255,0.04)', borderRadius: 8,
            fontSize: 12, color: '#aaa',
          }}>
            {score !== null && score >= 67
              ? '✅ Optionale Einheiten heute freigegeben (WHOOP ≥ 67)'
              : score !== null && score >= 34
              ? '⚡ Optionale Einheiten: nur wenn Pflichteinheiten leicht waren'
              : '🔴 Optionale Einheiten heute weglassen — Erholung hat Vorrang'}
          </div>
        </div>
      )}
    </div>
  )
}

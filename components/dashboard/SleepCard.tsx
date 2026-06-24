import { Panel } from './Panel'
import type { GarminSleep, GarminBodyBattery } from '@/lib/types'

type Props = { sleep: GarminSleep | null; bodyBattery: GarminBodyBattery | null }

function scoreColor(s: number) {
  return s >= 80 ? 'var(--ok)' : s >= 60 ? 'var(--warn)' : 'var(--danger)'
}
function scoreLabel(s: number) {
  return s >= 80 ? 'Sehr gut' : s >= 60 ? 'Gut' : 'Niedrig'
}
function fmtDuration(min: number) {
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

export function SleepCard({ sleep, bodyBattery }: Props) {
  if (!sleep) return (
    <Panel>
      <div className="panel-label">SCHLAF &amp; ERHOLUNG</div>
      <div style={{ color: 'var(--ink-3)', fontSize: '0.75rem', marginTop: 6 }}>
        Keine Schlafdaten — Sync läuft täglich ~05:00 UTC
      </div>
    </Panel>
  )

  const score          = sleep.sleep_score ?? 0
  const morningBattery = bodyBattery?.morning_score ?? null
  const deepPct        = sleep.total_sleep_min && sleep.deep_sleep_min
    ? Math.round(sleep.deep_sleep_min / sleep.total_sleep_min * 100)
    : null

  const metrics: [string, string][] = [
    ['HRV',       sleep.hrv_nightly    != null ? `${sleep.hrv_nightly} ms`          : '—'],
    ['Body Bat.', morningBattery       != null ? String(morningBattery)              : '—'],
    ['Schlafdauer', sleep.total_sleep_min != null ? fmtDuration(sleep.total_sleep_min) : '—'],
    ['Tiefschlaf',  deepPct            != null ? `${deepPct}%`                       : '—'],
  ]

  return (
    <Panel>
      <div className="panel-label">SCHLAF &amp; ERHOLUNG</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
        {/* Score */}
        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 52 }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 500, color: scoreColor(score), lineHeight: 1 }}>
            {score || '—'}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: 3, letterSpacing: '0.04em' }}>
            {score ? scoreLabel(score).toUpperCase() : 'SCORE'}
          </div>
        </div>

        {/* 2×2 Metrik-Grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {metrics.map(([label, value]) => (
            <div key={label} style={{
              background: 'var(--ink-4)', border: '1px solid var(--line)',
              borderRadius: 8, padding: '5px 8px',
            }}>
              <div style={{ fontSize: '0.58rem', color: 'var(--ink-3)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--ink-1)', fontFamily: 'var(--font-mono)' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

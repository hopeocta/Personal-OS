import { Panel } from './Panel'
import type { GarminSleep, GarminBodyBattery } from '@/lib/types'

type Props = {
  sleep: GarminSleep | null
  bodyBattery: GarminBodyBattery | null
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--ok)'
  if (score >= 60) return 'var(--warn)'
  return 'var(--danger)'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Sehr gut'
  if (score >= 60) return 'Gut'
  return 'Niedrig'
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}

export function SleepCard({ sleep, bodyBattery }: Props) {
  if (!sleep) {
    return (
      <Panel>
        <div className="panel-label">SCHLAF &amp; ERHOLUNG</div>
        <div style={{ color: 'var(--ink-3)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Keine Schlafdaten — Sync läuft täglich um 05:00 UTC
        </div>
      </Panel>
    )
  }

  const score = sleep.sleep_score ?? 0
  const morningBattery = bodyBattery?.morning_score ?? null

  const deepPct =
    sleep.total_sleep_min && sleep.deep_sleep_min
      ? Math.round((sleep.deep_sleep_min / sleep.total_sleep_min) * 100)
      : null

  const metrics: [string, string][] = [
    ['HRV', sleep.hrv_nightly != null ? `${sleep.hrv_nightly} ms` : '—'],
    ['Schlafdauer', sleep.total_sleep_min != null ? fmtDuration(sleep.total_sleep_min) : '—'],
    ['Tiefschlaf', deepPct != null ? `${deepPct}%` : '—'],
    ['Body Battery', morningBattery != null ? String(morningBattery) : '—'],
  ]

  return (
    <Panel>
      <div className="panel-label">SCHLAF &amp; ERHOLUNG</div>
      <div style={{ fontSize: '0.65rem', color: 'var(--ink-3)', marginBottom: '0.25rem' }}>
        {sleep.date}
      </div>

      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '3.5rem',
          fontWeight: 700,
          color: score ? scoreColor(score) : 'var(--ink-3)',
          lineHeight: 1,
          marginBottom: '0.25rem',
        }}
      >
        {score || '—'}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--ink-2)', marginBottom: '1rem' }}>
        Schlafwert{score ? ` — ${scoreLabel(score)}` : ''}
      </div>

      {metrics.map(([label, value]) => (
        <div
          key={label}
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>{label}</span>
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.75rem',
              color: 'var(--ink-1)',
            }}
          >
            {value}
          </span>
        </div>
      ))}

      {morningBattery != null && (
        <div className="progress-track" style={{ marginTop: '0.75rem' }}>
          <div
            className={`progress-fill ${morningBattery >= 70 ? 'ok' : morningBattery >= 40 ? 'warn' : 'danger'}`}
            style={{ width: `${morningBattery}%` }}
          />
        </div>
      )}
    </Panel>
  )
}

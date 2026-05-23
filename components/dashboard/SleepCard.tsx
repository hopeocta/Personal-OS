import { Panel } from './Panel'

type Props = {
  sleepScore: number
  hrv: number | null
  totalSleepMin: number
  deepSleepMin: number
  bodyBattery: number | null
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

export function SleepCard({ sleepScore, hrv, totalSleepMin, deepSleepMin, bodyBattery }: Props) {
  const deepPct = totalSleepMin > 0 ? Math.round((deepSleepMin / totalSleepMin) * 100) : 0

  const metrics: [string, string][] = [
    ['HRV', hrv != null ? `${hrv} ms` : '—'],
    ['Schlafdauer', fmtDuration(totalSleepMin)],
    ['Tiefschlaf', `${deepPct}%`],
    ['Body Battery', bodyBattery != null ? String(bodyBattery) : '—'],
  ]

  return (
    <Panel>
      <div className="panel-label">SCHLAF &amp; ERHOLUNG</div>

      <div
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '3rem',
          fontWeight: 600,
          color: scoreColor(sleepScore),
          lineHeight: 1,
          marginBottom: '0.375rem',
        }}
      >
        {sleepScore}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--ink-2)', marginBottom: '1rem' }}>
        Schlafwert — {scoreLabel(sleepScore)}
      </div>

      {metrics.map(([label, value]) => (
        <div
          key={label}
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>{label}</span>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: 'var(--ink-1)' }}>
            {value}
          </span>
        </div>
      ))}

      {bodyBattery != null && (
        <div
          style={{
            height: '6px',
            background: 'oklch(0.98 0 0 / 0.1)',
            borderRadius: '3px',
            marginTop: '0.75rem',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${bodyBattery}%`,
              background: 'var(--accent)',
              borderRadius: '3px',
            }}
          />
        </div>
      )}
    </Panel>
  )
}

import type { GarminSleep, GarminBodyBattery } from '@/lib/types'
import { MCard } from './MCard'

function scoreColor(s: number): string {
  if (s >= 80) return 'var(--ok)'
  if (s >= 60) return 'var(--warn)'
  return 'var(--danger)'
}
function scoreLabel(s: number): string {
  if (s >= 80) return 'Sehr gut'
  if (s >= 60) return 'Gut'
  return 'Niedrig'
}
function fmtDur(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}

const RING_C = 251.3 // 2π·40

export function MSleepRing({
  sleep,
  bodyBattery,
}: {
  sleep: GarminSleep | null
  bodyBattery: GarminBodyBattery | null
}) {
  if (!sleep) {
    return (
      <MCard label="Schlaf & Erholung">
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
          Keine Schlafdaten — Sync läuft täglich
        </div>
      </MCard>
    )
  }

  const score = sleep.sleep_score ?? 0
  const color = score ? scoreColor(score) : 'var(--ink-3)'
  const offset = RING_C * (1 - score / 100)
  const battery = bodyBattery?.morning_score ?? null
  const deepPct =
    sleep.total_sleep_min && sleep.deep_sleep_min
      ? Math.round((sleep.deep_sleep_min / sleep.total_sleep_min) * 100)
      : null

  const tiles: [string, string][] = [
    ['HRV', sleep.hrv_nightly != null ? `${sleep.hrv_nightly} ms` : '—'],
    ['Dauer', sleep.total_sleep_min != null ? fmtDur(sleep.total_sleep_min) : '—'],
    ['Tiefschlaf', deepPct != null ? `${deepPct}%` : '—'],
    ['Body Battery', battery != null ? String(battery) : '—'],
  ]

  return (
    <MCard label="Schlaf & Erholung">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="108" height="108" viewBox="0 0 100 100" style={{ flexShrink: 0 }} aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--line)" strokeWidth="9" />
          {score > 0 && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
            />
          )}
          <text
            x="50"
            y="49"
            textAnchor="middle"
            fontSize="26"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fill: 'var(--ink-0)' }}
          >
            {score || '—'}
          </text>
          <text
            x="50"
            y="63"
            textAnchor="middle"
            fontSize="7"
            style={{ fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)', letterSpacing: '0.1em' }}
          >
            {score ? scoreLabel(score).toUpperCase() : 'KEIN WERT'}
          </text>
        </svg>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
          {tiles.map(([label, value]) => (
            <div key={label}>
              <div className="panel-label" style={{ marginBottom: 2 }}>
                {label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 600,
                  fontSize: '1.05rem',
                  color: 'var(--ink-0)',
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {battery != null && (
        <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${battery}%`, background: 'var(--accent)', borderRadius: 3 }} />
        </div>
      )}
    </MCard>
  )
}

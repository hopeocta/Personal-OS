'use client'
import { useState } from 'react'
import { MCard } from './MCard'
import type { MarktSignal } from '@/lib/types'

const TIER_ORDER = ['Kurzfristig', 'Mittelfristig', 'Stabil'] as const
const TIER_SHORT: Record<string, string> = {
  Kurzfristig: 'KZ',
  Mittelfristig: 'MF',
  Stabil: 'LZ',
}

const CONF_COLOR: Record<string, string> = {
  Hoch: 'var(--sport-run)',
  Mittel: '#d4a017',
  'Mittel-Hoch': '#d4a017',
  Niedrig: 'var(--ink-3)',
}

function deltaColor(d: number | null) {
  if (d === null) return 'var(--ink-3)'
  if (d > 0) return 'var(--sport-run)'
  if (d < 0) return '#e05252'
  return 'var(--ink-3)'
}

function dedup(signals: MarktSignal[]): MarktSignal[] {
  const seen = new Map<string, MarktSignal>()
  for (const s of signals) {
    if (!seen.has(s.ticker)) seen.set(s.ticker, s)
  }
  return Array.from(seen.values())
}

function confidenceRank(c: string) {
  if (c === 'Hoch') return 0
  if (c === 'Mittel-Hoch') return 1
  if (c === 'Mittel') return 2
  return 3
}

function SignalRow({ signal }: { signal: MarktSignal }) {
  const [open, setOpen] = useState(false)
  const delta = signal.delta_pct
  return (
    <div
      onClick={() => setOpen((o) => !o)}
      style={{ padding: '5px 0', borderBottom: '1px solid var(--surface-2)', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: '0.62rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: 'var(--ink-3)', background: 'var(--surface-2)',
          borderRadius: 3, padding: '1px 4px',
        }}>
          {TIER_SHORT[signal.tier] ?? signal.tier.slice(0, 2)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--ink-0)', minWidth: 46 }}>
          {signal.ticker}
        </span>
        <span style={{ fontSize: '0.62rem', color: CONF_COLOR[signal.confidence] ?? 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
          {signal.confidence.toUpperCase()}
        </span>
        <span style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)', color: deltaColor(delta), marginLeft: 'auto' }}>
          {delta === null ? '—' : delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
        </span>
      </div>
      {!open && (
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)', marginTop: 1, paddingLeft: 2 }}>
          {signal.company}
        </div>
      )}
      {open && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>{signal.thesis}</div>
          {signal.main_risk && (
            <div style={{ fontSize: '0.66rem', color: '#e05252', marginTop: 2 }}>⚠ {signal.main_risk}</div>
          )}
        </div>
      )}
    </div>
  )
}

export function MMarktSignals({ signals }: { signals: MarktSignal[] }) {
  const sorted = [...signals].sort((a, b) => b.date.localeCompare(a.date))
  const deduped = dedup(sorted)

  const picks = deduped
    .filter((s) => s.tier !== 'Avoid')
    .sort((a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence))
    .slice(0, 6)

  const avoids = deduped.filter((s) => s.tier === 'Avoid').slice(0, 5)

  if (picks.length === 0 && avoids.length === 0) return null

  return (
    <MCard label="Markt-Signale">
      {picks.map((s) => <SignalRow key={s.signal_id} signal={s} />)}

      {avoids.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.1em', color: '#e05252', marginBottom: 4 }}>
            ⛔ AVOID
          </div>
          {avoids.map((s) => (
            <div key={s.signal_id} style={{ display: 'flex', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--surface-2)', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem', color: '#e05252', minWidth: 46 }}>{s.ticker}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--ink-2)' }}>{s.company}</span>
            </div>
          ))}
        </div>
      )}
    </MCard>
  )
}

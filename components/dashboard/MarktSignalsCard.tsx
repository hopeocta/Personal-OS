'use client'
import { useState } from 'react'
import { Panel } from './Panel'
import type { MarktSignal } from '@/lib/types'

const TIER_ORDER = ['Kurzfristig', 'Mittelfristig', 'Stabil'] as const
const TIER_LABELS: Record<string, string> = {
  Kurzfristig: 'KURZFRISTIG',
  Mittelfristig: 'MITTELFRISTIG',
  Stabil: 'LANGFRISTIG / STABIL',
}

const CONF_COLOR: Record<string, string> = {
  Hoch: 'var(--sport-run)',
  Mittel: '#d4a017',
  'Mittel-Hoch': '#d4a017',
  Niedrig: 'var(--ink-3)',
}

function confidenceColor(c: string) {
  return CONF_COLOR[c] ?? 'var(--ink-3)'
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
    const key = `${s.ticker}__${s.tier}`
    if (!seen.has(key)) seen.set(key, s)
  }
  return Array.from(seen.values())
}

function confidenceRank(c: string) {
  if (c === 'Hoch') return 0
  if (c === 'Mittel-Hoch') return 1
  if (c === 'Mittel') return 2
  return 3
}

function Row({ signal }: { signal: MarktSignal }) {
  const [open, setOpen] = useState(false)
  const delta = signal.delta_pct

  return (
    <div
      onClick={() => setOpen((o) => !o)}
      style={{
        cursor: 'pointer',
        padding: '6px 0',
        borderBottom: '1px solid var(--surface-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', color: 'var(--ink-0)', minWidth: 52 }}>
          {signal.ticker}
        </span>
        <span style={{
          fontSize: '0.62rem', fontFamily: 'var(--font-mono)',
          color: confidenceColor(signal.confidence),
          border: `1px solid ${confidenceColor(signal.confidence)}`,
          borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap',
        }}>
          {signal.confidence.toUpperCase()}
        </span>
        <span style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)', color: deltaColor(delta), minWidth: 44 }}>
          {delta === null ? '—' : delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
        </span>
        <span style={{ fontSize: '0.74rem', color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {signal.company}
        </span>
        <span style={{ fontSize: '0.6rem', color: 'var(--ink-3)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && signal.thesis && (
        <div style={{ marginTop: 4, paddingLeft: 60 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>{signal.thesis}</div>
          {signal.main_risk && (
            <div style={{ fontSize: '0.68rem', color: '#e05252', marginTop: 3 }}>⚠ {signal.main_risk}</div>
          )}
        </div>
      )}
    </div>
  )
}

function AvoidRow({ signal }: { signal: MarktSignal }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      onClick={() => setOpen((o) => !o)}
      style={{ cursor: 'pointer', padding: '5px 0', borderBottom: '1px solid var(--surface-2)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem', color: '#e05252', minWidth: 52 }}>
          {signal.ticker}
        </span>
        <span style={{ fontSize: '0.74rem', color: 'var(--ink-2)', flex: 1 }}>{signal.company}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--ink-3)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && signal.thesis && (
        <div style={{ marginTop: 4, paddingLeft: 60 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>{signal.thesis}</div>
        </div>
      )}
    </div>
  )
}

export function MarktSignalsCard({ signals }: { signals: MarktSignal[] }) {
  // Sort by date desc, then dedup per ticker+tier
  const sorted = [...signals].sort((a, b) => b.date.localeCompare(a.date))
  const deduped = dedup(sorted)

  const picks = deduped.filter((s) => s.tier !== 'Avoid')
  const avoids = deduped.filter((s) => s.tier === 'Avoid').slice(0, 5)

  const grouped: Record<string, MarktSignal[]> = {}
  for (const t of TIER_ORDER) {
    grouped[t] = picks
      .filter((s) => s.tier === t)
      .sort((a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence))
      .slice(0, 3)
  }

  const hasAny = Object.values(grouped).some((g) => g.length > 0) || avoids.length > 0

  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.12em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
          Markt-Signale
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--ink-3)' }}>
          Klick → These
        </span>
      </div>

      {!hasAny && (
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Keine aktiven Signale.</div>
      )}

      {TIER_ORDER.map((tier) =>
        grouped[tier].length === 0 ? null : (
          <div key={tier} style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 4 }}>
              {TIER_LABELS[tier]}
            </div>
            {grouped[tier].map((s) => <Row key={s.signal_id} signal={s} />)}
          </div>
        )
      )}

      {avoids.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.1em', color: '#e05252', marginBottom: 4 }}>
            ⛔ AVOID
          </div>
          {avoids.map((s) => <AvoidRow key={s.signal_id} signal={s} />)}
        </div>
      )}
    </Panel>
  )
}

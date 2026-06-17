'use client'
import { useState } from 'react'
import { MCard } from './MCard'

export function MWochenrueckblick() {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/briefing/week')
      const data = await res.json()
      setSummary(data.summary ?? '—')
    } catch {
      setSummary('Fehler beim Laden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MCard label="Diese Woche">
      {summary ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--ink-1)', lineHeight: 1.65, fontFamily: 'var(--font-serif)' }}>
          {summary}
        </div>
      ) : (
        <button
          onClick={load}
          disabled={loading}
          style={{
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: '0.82rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            width: '100%',
          }}
        >
          {loading ? 'Zusammenfassung lädt…' : 'Woche zusammenfassen'}
        </button>
      )}
    </MCard>
  )
}

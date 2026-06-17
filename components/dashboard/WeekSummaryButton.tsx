'use client'
import { useState } from 'react'

export function WeekSummaryButton() {
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
    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '0.35rem' }}>
        DIESE WOCHE
      </div>
      {summary ? (
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.82rem', lineHeight: 1.75, color: 'var(--ink-2)' }}>
          {summary}
        </div>
      ) : (
        <button
          onClick={load}
          disabled={loading}
          className="btn btn-secondary"
          style={{ fontSize: '0.72rem', padding: '4px 12px', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Lädt…' : 'Zusammenfassen'}
        </button>
      )}
    </div>
  )
}

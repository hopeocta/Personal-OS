'use client'

import { useState, useEffect } from 'react'
import { Panel } from './Panel'
import type { StrengthSession } from '@/lib/types'

type Intensity = 1 | 2 | 3

const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 1, label: 'LEICHT' },
  { value: 2, label: 'MITTEL' },
  { value: 3, label: 'SCHWER' },
]

const SESSION_TYPES = ['Oberkörper', 'Unterkörper', 'Ganzkörper', 'Ausdauer + Kraft'] as const
type SessionType = (typeof SESSION_TYPES)[number]

const INTENSITY_LABELS: Record<Intensity, string> = { 1: 'LEICHT', 2: 'MITTEL', 3: 'SCHWER' }
const INTENSITY_COLORS: Record<Intensity, string> = {
  1: 'var(--ok)',
  2: 'var(--warn)',
  3: 'var(--danger)',
}

type Props = { today: string }

const inputStyle: React.CSSProperties = {
  background: 'var(--line)',
  border: '1px solid var(--line)',
  borderRadius: '6px',
  color: 'var(--ink-1)',
  fontSize: '0.75rem',
  padding: '0.5rem 0.625rem',
  width: '100%',
  outline: 'none',
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export function StrengthLogger({ today }: Props) {
  const [date, setDate] = useState(today)
  const [intensity, setIntensity] = useState<Intensity>(2)
  const [sessionType, setSessionType] = useState<SessionType>('Oberkörper')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [recentSessions, setRecentSessions] = useState<StrengthSession[]>([])

  useEffect(() => {
    fetch('/api/strength?days=30')
      .then((r) => r.json())
      .then((data: StrengthSession[]) => {
        if (Array.isArray(data)) setRecentSessions(data.slice(0, 5))
      })
      .catch((e) => console.error('[strength] fetch error:', e))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/strength', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, intensity, session_type: sessionType, notes }),
      })
      if (!res.ok) throw new Error(await res.text())
      const newSession: StrengthSession = await res.json()
      setRecentSessions((prev) => [newSession, ...prev].slice(0, 5))
      setNotes('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('[strength] save error:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel>
      <div className="panel-label">KRAFTTRAINING LOGGER</div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label
          style={{ fontSize: '0.7rem', color: 'var(--ink-2)', display: 'block', marginBottom: '0.25rem' }}
        >
          Datum
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <label
          style={{ fontSize: '0.7rem', color: 'var(--ink-2)', display: 'block', marginBottom: '0.375rem' }}
        >
          Intensität
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {INTENSITIES.map(({ value, label }) => {
            const isActive = intensity === value
            return (
              <button
                key={value}
                onClick={() => setIntensity(value)}
                style={{
                  padding: '0.625rem',
                  borderRadius: '8px',
                  border: `1px solid ${isActive ? INTENSITY_COLORS[value] : 'var(--line-strong)'}`,
                  background: isActive
                    ? `${INTENSITY_COLORS[value]}22`
                    : 'var(--line)',
                  color: isActive ? INTENSITY_COLORS[value] : 'var(--ink-1)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label
          style={{ fontSize: '0.7rem', color: 'var(--ink-2)', display: 'block', marginBottom: '0.25rem' }}
        >
          Einheit
        </label>
        <select
          value={sessionType}
          onChange={(e) => setSessionType(e.target.value as SessionType)}
          style={inputStyle}
        >
          {SESSION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label
          style={{ fontSize: '0.7rem', color: 'var(--ink-2)', display: 'block', marginBottom: '0.25rem' }}
        >
          Notizen
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="z.B. Bankdrücken 5×5, Klimmzüge 3×8..."
          style={{ ...inputStyle, resize: 'none', fontFamily: 'system-ui, sans-serif' }}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saved ? 'var(--ok)' : 'var(--accent)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '0.5rem 1rem',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          cursor: saving ? 'not-allowed' : 'pointer',
          width: '100%',
          marginTop: '0.25rem',
          opacity: saving ? 0.7 : 1,
          transition: 'background 0.2s',
        }}
      >
        {saving ? 'SPEICHERT...' : saved ? 'GESPEICHERT ✓' : 'SPEICHERN'}
      </button>

      {recentSessions.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--line)',
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--ink-3)',
              marginBottom: '0.5rem',
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '0.08em',
            }}
          >
            LETZTE EINHEITEN
          </div>
          {recentSessions.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: 'var(--ink-2)',
                padding: '0.3rem 0',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span>{fmtDate(s.date)} — {s.session_type ?? 'Training'}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.65rem',
                  color: INTENSITY_COLORS[s.intensity],
                }}
              >
                {INTENSITY_LABELS[s.intensity]}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

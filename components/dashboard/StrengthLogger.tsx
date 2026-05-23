'use client'

import { useState } from 'react'
import { Panel } from './Panel'

type Intensity = 1 | 2 | 3

const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 1, label: 'LEICHT' },
  { value: 2, label: 'MITTEL' },
  { value: 3, label: 'SCHWER' },
]

const SESSION_TYPES = ['Oberkörper', 'Unterkörper', 'Ganzkörper', 'Ausdauer + Kraft'] as const
type SessionType = (typeof SESSION_TYPES)[number]

const INTENSITY_LABELS: Record<Intensity, string> = { 1: 'LEICHT', 2: 'MITTEL', 3: 'SCHWER' }

type RecentSession = { date: string; sessionType: string; intensity: Intensity }
type Props = { today: string; recentSessions: RecentSession[] }

const inputStyle: React.CSSProperties = {
  background: 'oklch(0.98 0 0 / 0.05)',
  border: '1px solid oklch(0.98 0 0 / 0.1)',
  borderRadius: '6px',
  color: 'var(--ink-1)',
  fontSize: '0.75rem',
  padding: '0.5rem 0.625rem',
  width: '100%',
  outline: 'none',
}

export function StrengthLogger({ today, recentSessions }: Props) {
  const [date, setDate] = useState(today)
  const [intensity, setIntensity] = useState<Intensity>(2)
  const [sessionType, setSessionType] = useState<SessionType>('Oberkörper')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    // API will be wired in Abend 5
    console.log('Strength session:', { date, intensity, sessionType, notes })
    setSaving(false)
  }

  return (
    <Panel>
      <div className="panel-label">KRAFTTRAINING LOGGER</div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label style={{ fontSize: '0.7rem', color: 'var(--ink-2)', display: 'block', marginBottom: '0.25rem' }}>
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
        <label style={{ fontSize: '0.7rem', color: 'var(--ink-2)', display: 'block', marginBottom: '0.375rem' }}>
          Intensität
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {INTENSITIES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setIntensity(value)}
              style={{
                padding: '0.625rem',
                borderRadius: '8px',
                border: `1px solid ${intensity === value ? 'var(--accent)' : 'oklch(0.98 0 0 / 0.12)'}`,
                background: intensity === value ? 'var(--accent)' : 'oklch(0.98 0 0 / 0.04)',
                color: intensity === value ? 'white' : 'var(--ink-1)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label style={{ fontSize: '0.7rem', color: 'var(--ink-2)', display: 'block', marginBottom: '0.25rem' }}>
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
        <label style={{ fontSize: '0.7rem', color: 'var(--ink-2)', display: 'block', marginBottom: '0.25rem' }}>
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
          background: 'var(--accent)',
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
        }}
      >
        {saving ? 'SPEICHERT...' : 'SPEICHERN'}
      </button>

      {recentSessions.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid oklch(0.98 0 0 / 0.06)',
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
          {recentSessions.map((s, i) => (
            <div
              key={i}
              style={{
                fontSize: '0.72rem',
                color: 'var(--ink-2)',
                padding: '0.3rem 0',
                borderBottom:
                  i < recentSessions.length - 1 ? '1px solid oklch(0.98 0 0 / 0.04)' : 'none',
              }}
            >
              {s.date} — {s.sessionType} — {INTENSITY_LABELS[s.intensity]}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

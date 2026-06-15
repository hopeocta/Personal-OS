'use client'

import { useState } from 'react'
import { Panel } from './Panel'

type CaptureType = 'training' | 'musik' | 'lernen' | 'idee' | 'essen'

const TYPES: { value: CaptureType; label: string }[] = [
  { value: 'training', label: '🏃 Training' },
  { value: 'musik', label: '🎵 Musik' },
  { value: 'lernen', label: '📚 Lernen' },
  { value: 'idee', label: '💡 Idee' },
  { value: 'essen', label: '🍎 Essen' },
]

export function QuickCapture() {
  const [text, setText] = useState('')
  const [active, setActive] = useState<CaptureType | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSend(type: CaptureType) {
    if (!text.trim()) return
    setActive(type)
    setSaving(true)
    // API will be wired in Abend 6
    console.log('Capture:', { type, text: text.trim() })
    setSaving(false)
    setText('')
    setActive(null)
  }

  const hasText = text.trim().length > 0

  return (
    <Panel>
      <div className="panel-label">QUICK CAPTURE</div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Hier tippen oder Voice Note via Telegram..."
        style={{
          background: 'var(--line)',
          border: '1px solid var(--line)',
          borderRadius: '6px',
          color: 'var(--ink-1)',
          fontSize: '0.75rem',
          padding: '0.5rem 0.625rem',
          width: '100%',
          resize: 'none',
          outline: 'none',
          fontFamily: 'system-ui, sans-serif',
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.625rem' }}>
        {TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleSend(value)}
            disabled={saving || !hasText}
            style={{
              fontSize: '0.7rem',
              padding: '0.3rem 0.625rem',
              borderRadius: '20px',
              border: `1px solid ${active === value ? 'var(--accent)' : 'var(--line-strong)'}`,
              background:
                active === value ? '#F3E0D5' : 'var(--line)',
              color: hasText ? 'var(--ink-1)' : 'var(--ink-3)',
              cursor: hasText ? 'pointer' : 'not-allowed',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </Panel>
  )
}

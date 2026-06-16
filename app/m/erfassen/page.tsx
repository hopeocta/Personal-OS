'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MCard } from '@/components/mobile/MCard'
import { localDateKey } from '@/lib/dateUtils'
import type { KnowledgeEntry } from '@/lib/types'

type Mode = 'essen' | 'notiz'

export default function MobileErfassen() {
  const [mode, setMode] = useState<Mode>('essen')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const [foodNotes, setFoodNotes] = useState('')
  const [noteEntries, setNoteEntries] = useState<KnowledgeEntry[]>([])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadRecent = useCallback(async () => {
    const today = localDateKey()
    try {
      const [nRes, kRes] = await Promise.all([
        fetch(`/api/nutrition?date=${today}`).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/knowledge?limit=20').then((r) => (r.ok ? r.json() : [])),
      ])
      setFoodNotes(nRes && typeof nRes === 'object' && 'notes' in nRes ? (nRes.notes ?? '') : '')
      const notes = Array.isArray(kRes)
        ? (kRes as KnowledgeEntry[]).filter((k) => k.source === 'mobile_capture').slice(0, 5)
        : []
      setNoteEntries(notes)
    } catch (e) {
      console.error('[m/erfassen] load error:', e)
    }
  }, [])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  const handleSave = async () => {
    const value = text.trim()
    if (!value || saving) return
    setSaving(true)
    setError(null)
    try {
      if (mode === 'essen') {
        const res = await fetch('/api/m/food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: value }),
        })
        if (!res.ok) throw new Error(await res.text())
        showToast('Essen gespeichert')
      } else {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: value, source: 'mobile_capture' }),
        })
        const entry = await res.json()
        if (!res.ok) throw new Error((entry as { error?: string }).error ?? `HTTP ${res.status}`)
        showToast(entry.summary ? `Notiz: ${entry.summary}` : 'Notiz gespeichert')
      }
      setText('')
      await loadRecent()
    } catch (e) {
      console.error('[m/erfassen] save error:', e)
      setError('Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  // ── Sprachnotiz → Whisper ──
  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        await transcribeBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      setError('Mikrofon-Zugriff verweigert')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    setTranscribing(true)
  }

  const transcribeBlob = async (blob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { text: string }
      setText((prev) => (prev ? prev + ' ' + data.text : data.text))
      textareaRef.current?.focus()
    } catch {
      setError('Transkription fehlgeschlagen')
    } finally {
      setTranscribing(false)
    }
  }

  const foodLines = foodNotes.split('\n').map((l) => l.trim()).filter(Boolean).reverse()

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '1.4rem', color: 'var(--ink-0)' }}>
        Erfassen
      </div>

      {/* Umschalter ESSEN / NOTIZ */}
      <div style={{ display: 'flex', background: '#EFE7DA', borderRadius: 12, padding: 3, gap: 3 }}>
        {(['essen', 'notiz'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              textAlign: 'center',
              border: 'none',
              borderRadius: 9,
              padding: '10px 0',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              background: mode === m ? 'var(--accent)' : 'transparent',
              color: mode === m ? '#FBF3EC' : 'var(--ink-2)',
            }}
          >
            {m === 'essen' ? 'ESSEN' : 'NOTIZ'}
          </button>
        ))}
      </div>

      {/* Eingabe */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={mode === 'essen' ? 'Was hast du gegessen?' : 'Notiz, Erkenntnis, Idee…'}
        rows={4}
        style={{
          width: '100%',
          background: '#FFFDF8',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: '12px',
          color: 'var(--ink-0)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.95rem',
          lineHeight: 1.5,
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Mikro + Speichern */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={recording ? stopRecording : () => void startRecording()}
          disabled={transcribing}
          aria-label={recording ? 'Aufnahme stoppen' : 'Sprachnotiz'}
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            flexShrink: 0,
            border: `1px solid ${recording ? 'var(--danger)' : 'var(--line-strong)'}`,
            background: recording ? 'var(--danger)' : '#FFFDF8',
            color: recording ? '#fff' : 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: transcribing ? 'default' : 'pointer',
            opacity: transcribing ? 0.5 : 1,
          }}
        >
          {transcribing ? (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--ink-3)',
                animation: 'pulse 0.8s ease-in-out infinite',
              }}
            />
          ) : recording ? (
            <svg width="16" height="16" viewBox="0 0 16 16">
              <rect x="3" y="3" width="10" height="10" rx="2" fill="#fff" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
            </svg>
          )}
        </button>

        <button
          onClick={() => void handleSave()}
          disabled={!text.trim() || saving}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: 12,
            padding: '15px 0',
            cursor: !text.trim() || saving ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            background: 'var(--accent)',
            color: '#FBF3EC',
            opacity: !text.trim() ? 0.45 : 1,
          }}
        >
          {saving ? 'SPEICHERN…' : 'SPEICHERN'}
        </button>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.06em', color: 'var(--ink-3)', textAlign: 'center' }}>
        {mode === 'essen' ? 'TIPPEN ODER MIKRO · LANDET IN ERNÄHRUNG' : 'TIPPEN ODER MIKRO · CLAUDE KATEGORISIERT'}
      </div>

      {toast && (
        <div
          style={{
            background: '#EEF3E2',
            border: '1px solid var(--ok)',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: '0.78rem',
            color: 'var(--ink-1)',
          }}
        >
          ✓ {toast}
        </div>
      )}
      {error && (
        <div style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</div>
      )}

      {/* Heute erfasst */}
      <MCard label="Heute erfasst">
        {mode === 'essen' ? (
          foodLines.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Noch nichts gegessen geloggt</div>
          ) : (
            foodLines.map((line, i) => {
              const m = line.match(/^(\d{2}:\d{2})\s+(.*)$/)
              const time = m ? m[1] : ''
              const body = m ? m[2] : line
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '6px 0',
                    borderBottom: i < foodLines.length - 1 ? '1px solid var(--line)' : 'none',
                    fontSize: '0.8rem',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--ink-3)', flexShrink: 0 }}>
                    {time}
                  </span>
                  <span style={{ color: 'var(--ink-1)', lineHeight: 1.4 }}>{body}</span>
                </div>
              )
            })
          )
        ) : noteEntries.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Noch keine Notizen heute</div>
        ) : (
          noteEntries.map((k, i) => (
            <div
              key={k.id}
              style={{
                padding: '6px 0',
                borderBottom: i < noteEntries.length - 1 ? '1px solid var(--line)' : 'none',
                fontSize: '0.8rem',
                color: 'var(--ink-1)',
                lineHeight: 1.4,
              }}
            >
              · {k.summary ?? k.raw_text.slice(0, 80)}
            </div>
          ))
        )}
      </MCard>
    </div>
  )
}

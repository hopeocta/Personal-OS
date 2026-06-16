'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MCard } from '@/components/mobile/MCard'
import { localDateKey } from '@/lib/dateUtils'
import type { KnowledgeEntry } from '@/lib/types'
import type { Flashcard } from '@/lib/flashcards'

type Mode = 'essen' | 'notiz' | 'vokabeln'

// ── Vokabel-Trainer ──────────────────────────────────────────────────────────

function VokabelTrainer() {
  const [card, setCard] = useState<Flashcard | null>(null)
  const [due, setDue] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCard = useCallback(async () => {
    setLoading(true)
    setRevealed(false)
    setError(null)
    try {
      const res = await fetch('/api/m/flashcards')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { card: Flashcard | null; due: number }
      setCard(data.card ?? null)
      setDue(data.due)
      if (!data.card) setDone(true)
    } catch (e) {
      console.error('[vokabeln] load error:', e)
      setError('Karten konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCard()
  }, [loadCard])

  const rate = async (quality: 0 | 1 | 2 | 3) => {
    if (!card || rating) return
    setRating(true)
    try {
      const res = await fetch('/api/m/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, quality }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { card: Flashcard | null; due: number }
      setCard(data.card ?? null)
      setDue(data.due)
      setRevealed(false)
      if (!data.card) setDone(true)
    } catch (e) {
      console.error('[vokabeln] rate error:', e)
      setError('Bewertung fehlgeschlagen')
    } finally {
      setRating(false)
    }
  }

  const isItDe = card?.tags?.includes('it-de') ?? false
  const lang = isItDe ? 'IT → DE' : 'DE → IT'

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '0.8rem', color: 'var(--ink-3)' }}>Lädt…</div>
  }
  if (error) {
    return <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</div>
  }
  if (done || !card) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: '2rem' }}>✓</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '1.2rem', color: 'var(--ink-0)' }}>
          Heute fertig!
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Alle Karten für heute gelernt</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Fortschritt */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
          {lang}
        </span>
        {due != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)' }}>
            {due} KARTEN HEUTE
          </span>
        )}
      </div>

      {/* Karte */}
      <div
        style={{
          background: '#FFFDF8',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minHeight: 180,
        }}
      >
        {/* Vorderseite */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              fontSize: '1.6rem',
              color: 'var(--ink-0)',
              lineHeight: 1.3,
            }}
          >
            {card.front}
          </div>
        </div>

        {/* Rückseite */}
        {revealed ? (
          <>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.2rem',
                  color: 'var(--accent)',
                  lineHeight: 1.3,
                }}
              >
                {card.back}
              </div>
              {card.example_sentence && (
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.75rem',
                    color: 'var(--ink-3)',
                    marginTop: 8,
                    fontStyle: 'italic',
                    lineHeight: 1.45,
                  }}
                >
                  {card.example_sentence}
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '14px 0',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              letterSpacing: '0.1em',
              background: 'var(--accent)',
              color: '#FBF3EC',
              marginTop: 'auto',
            }}
          >
            ZEIGEN
          </button>
        )}
      </div>

      {/* Bewertungs-Buttons */}
      {revealed && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          {([
            { label: 'Falsch', q: 0 as const, bg: 'var(--danger)', light: '#FFF0EE' },
            { label: 'Schwer', q: 1 as const, bg: '#D97706', light: '#FEF3C7' },
            { label: 'Gut', q: 2 as const, bg: 'var(--ok)', light: '#F0FDF4' },
            { label: 'Perfekt', q: 3 as const, bg: '#2563EB', light: '#EFF6FF' },
          ]).map(({ label, q, bg, light }) => (
            <button
              key={q}
              onClick={() => void rate(q)}
              disabled={rating}
              style={{
                border: `1px solid ${bg}`,
                borderRadius: 10,
                padding: '10px 0',
                cursor: rating ? 'default' : 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.62rem',
                letterSpacing: '0.06em',
                background: light,
                color: bg,
                opacity: rating ? 0.5 : 1,
              }}
            >
              {label.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Hauptseite ───────────────────────────────────────────────────────────────

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

      {/* Umschalter ESSEN / NOTIZ / VOKABELN */}
      <div style={{ display: 'flex', background: '#EFE7DA', borderRadius: 12, padding: 3, gap: 3 }}>
        {(['essen', 'notiz', 'vokabeln'] as Mode[]).map((m) => (
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
              fontSize: '0.66rem',
              letterSpacing: '0.07em',
              background: mode === m ? 'var(--accent)' : 'transparent',
              color: mode === m ? '#FBF3EC' : 'var(--ink-2)',
            }}
          >
            {m === 'essen' ? 'ESSEN' : m === 'notiz' ? 'NOTIZ' : 'LERNEN'}
          </button>
        ))}
      </div>

      {/* Vokabeltrainer */}
      {mode === 'vokabeln' && <VokabelTrainer />}

      {/* Eingabe (nur Essen/Notiz) */}
      {mode !== 'vokabeln' && (
        <>
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
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-3)', animation: 'pulse 0.8s ease-in-out infinite' }} />
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
            <div style={{ background: '#EEF3E2', border: '1px solid var(--ok)', borderRadius: 10, padding: '8px 12px', fontSize: '0.78rem', color: 'var(--ink-1)' }}>
              ✓ {toast}
            </div>
          )}
          {error && <div style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</div>}

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
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < foodLines.length - 1 ? '1px solid var(--line)' : 'none', fontSize: '0.8rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--ink-3)', flexShrink: 0 }}>{time}</span>
                      <span style={{ color: 'var(--ink-1)', lineHeight: 1.4 }}>{body}</span>
                    </div>
                  )
                })
              )
            ) : noteEntries.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Noch keine Notizen heute</div>
            ) : (
              noteEntries.map((k, i) => (
                <div key={k.id} style={{ padding: '6px 0', borderBottom: i < noteEntries.length - 1 ? '1px solid var(--line)' : 'none', fontSize: '0.8rem', color: 'var(--ink-1)', lineHeight: 1.4 }}>
                  · {k.summary ?? k.raw_text.slice(0, 80)}
                </div>
              ))
            )}
          </MCard>
        </>
      )}
    </div>
  )
}

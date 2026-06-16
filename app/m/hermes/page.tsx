'use client'

import { useEffect, useRef, useState } from 'react'
import { MarkdownText } from '@/components/MarkdownText'
import type { DocHit } from '@/lib/telegram'

type Entry = {
  id: number
  question: string
  answer: string
  loading: boolean
  error: string
  docs: DocHit[]
  sent: Record<string, 'idle' | 'sending' | 'done' | 'error'>
}

export default function MobileHermes() {
  const [history, setHistory] = useState<Entry[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nextId = useRef(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const ask = async () => {
    const question = input.trim()
    if (!question || busy) return
    setInput('')
    setError(null)
    const id = nextId.current++
    setHistory((prev) => [{ id, question, answer: '', loading: true, error: '', docs: [], sent: {} }, ...prev])
    setBusy(true)
    try {
      const [askRes, docsRes] = await Promise.all([
        fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        }).then((r) => r.json().then((j) => ({ ok: r.ok, j }))),
        fetch(`/api/m/docs?q=${encodeURIComponent(question)}`)
          .then((r) => (r.ok ? r.json() : { hits: [] }))
          .catch(() => ({ hits: [] })),
      ])
      if (!askRes.ok) throw new Error((askRes.j as { error?: string }).error ?? 'Fehler')
      const answer = (askRes.j as { text?: string }).text ?? ''
      const docs = Array.isArray(docsRes?.hits) ? (docsRes.hits as DocHit[]) : []
      setHistory((prev) => prev.map((e) => (e.id === id ? { ...e, answer, docs, loading: false } : e)))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      setHistory((prev) => prev.map((en) => (en.id === id ? { ...en, loading: false, error: msg } : en)))
    } finally {
      setBusy(false)
    }
  }

  const sendDoc = async (entryId: number, doc: DocHit) => {
    setHistory((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, sent: { ...e.sent, [doc.id]: 'sending' } } : e)),
    )
    try {
      const res = await fetch('/api/m/send-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id }),
      })
      if (!res.ok) throw new Error(await res.text())
      setHistory((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, sent: { ...e.sent, [doc.id]: 'done' } } : e)),
      )
    } catch (e) {
      console.error('[m/hermes] send error:', e)
      setHistory((prev) =>
        prev.map((en) => (en.id === entryId ? { ...en, sent: { ...en.sent, [doc.id]: 'error' } } : en)),
      )
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
      setInput((prev) => (prev ? prev + ' ' + data.text : data.text))
      textareaRef.current?.focus()
    } catch {
      setError('Transkription fehlgeschlagen')
    } finally {
      setTranscribing(false)
    }
  }

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: '#F0E2D8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
            <path d="M16 8L2 22" />
            <path d="M17.5 15H9" />
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '1.25rem', color: 'var(--ink-0)' }}>
            Hermes
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>
            FRAGT DEINE DATEN · HOLT DOKUMENTE
          </div>
        </div>
      </div>

      {/* Eingabe */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask()
            }
          }}
          placeholder="Frag deine Daten…"
          rows={1}
          style={{
            flex: 1,
            background: '#FFFDF8',
            border: '1px solid var(--line)',
            borderRadius: 20,
            padding: '10px 14px',
            color: 'var(--ink-0)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.9rem',
            lineHeight: 1.4,
            resize: 'none',
            outline: 'none',
            maxHeight: 120,
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={recording ? stopRecording : () => void startRecording()}
          disabled={transcribing}
          aria-label={recording ? 'Aufnahme stoppen' : 'Sprachnotiz'}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            flexShrink: 0,
            border: `1px solid ${recording ? 'var(--danger)' : 'var(--line-strong)'}`,
            background: recording ? 'var(--danger)' : '#FFFDF8',
            color: recording ? '#fff' : 'var(--ink-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: transcribing ? 'default' : 'pointer',
          }}
        >
          {recording ? (
            <svg width="14" height="14" viewBox="0 0 16 16">
              <rect x="3" y="3" width="10" height="10" rx="2" fill="#fff" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
            </svg>
          )}
        </button>
        <button
          onClick={() => void ask()}
          disabled={!input.trim() || busy}
          aria-label="Fragen"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            flexShrink: 0,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: !input.trim() || busy ? 'not-allowed' : 'pointer',
            opacity: !input.trim() ? 0.45 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>

      {error && <div style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</div>}

      {/* Leerstaat */}
      {history.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>Stell eine Frage — ich durchsuche alles.</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', letterSpacing: '0.06em' }}>
            GARMIN · SCHLAF · NOTIZEN · WISSEN
          </div>
        </div>
      )}

      {/* Verlauf (neueste oben) */}
      {history.map((e) => (
        <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              alignSelf: 'flex-end',
              maxWidth: '85%',
              background: 'var(--accent)',
              color: '#FBF3EC',
              borderRadius: '14px 14px 4px 14px',
              padding: '8px 12px',
              fontSize: '0.85rem',
              lineHeight: 1.4,
            }}
          >
            {e.question}
          </div>

          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '90%',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '14px 14px 14px 4px',
              padding: '10px 12px',
              fontSize: '0.85rem',
              color: 'var(--ink-1)',
              lineHeight: 1.5,
            }}
          >
            {e.loading ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-3)' }}>Suche…</span>
            ) : e.error ? (
              <span style={{ color: 'var(--danger)' }}>{e.error}</span>
            ) : (
              <>
                <MarkdownText text={e.answer} />
                {e.docs.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {e.docs.slice(0, 3).map((doc) => {
                      const state = e.sent[doc.id] ?? 'idle'
                      return (
                        <button
                          key={doc.id}
                          onClick={() => state === 'idle' && void sendDoc(e.id, doc)}
                          disabled={state === 'sending' || state === 'done'}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: '#FFFDF8',
                            border: `1px solid ${state === 'done' ? 'var(--ok)' : 'var(--line-strong)'}`,
                            borderRadius: 10,
                            padding: '7px 10px',
                            cursor: state === 'idle' ? 'pointer' : 'default',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.66rem',
                            letterSpacing: '0.04em',
                            color: state === 'done' ? 'var(--ok)' : 'var(--accent)',
                            textAlign: 'left',
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                          </svg>
                          <span style={{ flex: 1, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.summary ?? 'Dokument'}
                          </span>
                          <span style={{ flexShrink: 0 }}>
                            {state === 'done'
                              ? 'GESENDET ✓'
                              : state === 'sending'
                                ? '…'
                                : state === 'error'
                                  ? 'FEHLER'
                                  : 'AN TELEGRAM'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

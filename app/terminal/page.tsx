'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { TopRail } from '@/components/dashboard/TopRail'
import { SKILLS } from '@/lib/config/skills'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type UsageData = {
  cacheRead: number
  cacheWrite: number
  input: number
  output: number
}

const CATEGORIES = [
  'Zahnmedizin',
  'Triathlon',
  'Krafttraining',
  'Ernährung',
  'Musikproduktion',
  'FL Studio',
  'Sampling',
  'Allgemein',
]

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function TerminalPage() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('terminal_messages')
      return saved ? (JSON.parse(saved) as Message[]) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [skillKey, setSkillKey] = useState(() => localStorage.getItem('terminal_skill') ?? '')
  const [lernfach, setLernfach] = useState(() => localStorage.getItem('terminal_lernfach') ?? '')
  const [docCount, setDocCount] = useState<number | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Persist chat state to localStorage
  useEffect(() => {
    if (messages.length > 0) localStorage.setItem('terminal_messages', JSON.stringify(messages))
    else localStorage.removeItem('terminal_messages')
  }, [messages])
  useEffect(() => { localStorage.setItem('terminal_skill', skillKey) }, [skillKey])
  useEffect(() => { localStorage.setItem('terminal_lernfach', lernfach) }, [lernfach])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch doc count when lernfach changes
  useEffect(() => {
    if (!lernfach) {
      setDocCount(null)
      return
    }
    fetch(`/api/knowledge?category=${encodeURIComponent(lernfach)}&limit=200`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setDocCount(data.length)
      })
      .catch((err) => console.error('[terminal] doc count error:', err))
  }, [lernfach])

  const clearSession = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setUsage(null)
    setError('')
    localStorage.removeItem('terminal_messages')
  }, [])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setError('')
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages([...newMessages, { role: 'assistant', content: '' }])
    setStreaming(true)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          skillKey: skillKey || null,
          lernfach: lernfach || null,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Kein Stream erhalten')

      const decoder = new TextDecoder()
      let buffer = ''
      let usageJson = ''
      let separatorFound = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const raw = decoder.decode(value, { stream: true })

        if (!separatorFound) {
          const combined = buffer + raw
          const sepIdx = combined.indexOf('\x00')

          if (sepIdx >= 0) {
            buffer = combined.slice(0, sepIdx)
            usageJson = combined.slice(sepIdx + 1)
            separatorFound = true
          } else {
            buffer = combined
          }
        }

        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: buffer },
        ])
      }

      if (usageJson) {
        try {
          setUsage(JSON.parse(usageJson) as UsageData)
        } catch {
          /* ignore parse errors */
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(msg)
      console.error('[terminal] send error:', err)
      // Remove empty assistant placeholder on error
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1)
        return prev
      })
    } finally {
      setStreaming(false)
    }
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await transcribeBlob(blob)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch (err) {
      console.error('[terminal] mic error:', err)
      setError('Mikrofon-Zugriff verweigert')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    setTranscribing(true)
  }

  async function transcribeBlob(blob: Blob) {
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { text: string }

      setInput((prev) => (prev ? prev + ' ' + data.text : data.text))
      textareaRef.current?.focus()
    } catch (err) {
      console.error('[terminal] transcribe error:', err)
      setError('Transkription fehlgeschlagen')
    } finally {
      setTranscribing(false)
    }
  }

  async function saveSession() {
    if (messages.length === 0 || saving) return
    setSaving(true)
    setSavedOk(false)

    const sessionText = messages
      .map((m) => `[${m.role === 'user' ? 'Ich' : 'Claude'}]\n${m.content}`)
      .join('\n\n---\n\n')

    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: sessionText,
          source: 'chat_session',
          category: lernfach || undefined,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    } catch (err) {
      console.error('[terminal] save error:', err)
      setError('Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const cachePercent =
    usage && usage.cacheRead > 0
      ? Math.round((100 * usage.cacheRead) / (usage.cacheRead + usage.cacheWrite + usage.input))
      : null

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ink-4)',
      }}
    >
      <TopRail />

      {/* Controls bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.5rem 1rem',
          borderBottom: '1px solid oklch(0.98 0 0 / 0.08)',
          flexWrap: 'wrap',
        }}
      >
        {/* Skill selector */}
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.7rem',
              color: 'var(--ink-3)',
              letterSpacing: '0.05em',
            }}
          >
            SKILL
          </span>
          <select
            value={skillKey}
            onChange={(e) => {
              setSkillKey(e.target.value)
              clearSession()
            }}
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.75rem',
              background: 'oklch(0.98 0 0 / 0.06)',
              border: '1px solid oklch(0.98 0 0 / 0.15)',
              borderRadius: '6px',
              color: 'var(--ink-1)',
              padding: '0.25rem 0.5rem',
            }}
          >
            <option value="">Kein Skill</option>
            {Object.entries(SKILLS).map(([key, skill]) => (
              <option key={key} value={key}>
                {skill.label}
              </option>
            ))}
          </select>
        </label>

        <span style={{ color: 'oklch(0.98 0 0 / 0.15)', fontSize: '0.75rem' }}>|</span>

        {/* Lernfach selector */}
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.7rem',
              color: 'var(--ink-3)',
              letterSpacing: '0.05em',
            }}
          >
            LERNFACH
          </span>
          <select
            value={lernfach}
            onChange={(e) => {
              setLernfach(e.target.value)
              clearSession()
            }}
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.75rem',
              background: 'oklch(0.98 0 0 / 0.06)',
              border: '1px solid oklch(0.98 0 0 / 0.15)',
              borderRadius: '6px',
              color: 'var(--ink-1)',
              padding: '0.25rem 0.5rem',
            }}
          >
            <option value="">Kein Kontext</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* Doc count badge */}
        {lernfach && docCount !== null && (
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.7rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background:
                docCount > 0
                  ? 'oklch(0.72 0.18 145 / 0.15)'
                  : 'oklch(0.98 0 0 / 0.06)',
              color: docCount > 0 ? 'var(--ok)' : 'var(--ink-3)',
              border: `1px solid ${docCount > 0 ? 'oklch(0.72 0.18 145 / 0.3)' : 'oklch(0.98 0 0 / 0.1)'}`,
            }}
          >
            📚 {docCount > 0 ? `${docCount} Dok. geladen` : 'Keine Dokumente'}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Save / Clear buttons */}
        {messages.length > 0 && (
          <>
            <button
              onClick={() => void saveSession()}
              disabled={saving}
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.7rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid oklch(0.98 0 0 / 0.2)',
                color: savedOk ? 'var(--ok)' : 'var(--ink-2)',
                background: 'transparent',
                cursor: saving ? 'default' : 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {savedOk ? 'GESPEICHERT ✓' : saving ? '...' : 'SPEICHERN'}
            </button>
            <button
              onClick={clearSession}
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.7rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid oklch(0.98 0 0 / 0.2)',
                color: 'var(--ink-2)',
                background: 'transparent',
                cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              LEEREN
            </button>
          </>
        )}
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem 1rem',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: '200px',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.2, marginBottom: '0.75rem' }}>
                💬
              </div>
              <p
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.85rem',
                  color: 'var(--ink-3)',
                }}
              >
                {lernfach
                  ? `${lernfach} geladen — stell eine Frage`
                  : 'Schreib etwas oder wähle ein Lernfach'}
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              maxWidth: '48rem',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    borderRadius: msg.role === 'user' ? '1.25rem 1.25rem 0.25rem 1.25rem' : '1.25rem 1.25rem 1.25rem 0.25rem',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.6',
                    background:
                      msg.role === 'user'
                        ? 'var(--accent)'
                        : 'oklch(0.98 0 0 / 0.06)',
                    color: msg.role === 'user' ? 'white' : 'var(--ink-1)',
                    border:
                      msg.role === 'user'
                        ? 'none'
                        : '1px solid oklch(0.98 0 0 / 0.1)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                  {msg.role === 'assistant' &&
                    streaming &&
                    i === messages.length - 1 && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: '0.5rem',
                          height: '1rem',
                          marginLeft: '0.15rem',
                          background: 'var(--accent)',
                          borderRadius: '2px',
                          verticalAlign: 'text-bottom',
                          animation: 'pulse 1s ease-in-out infinite',
                        }}
                      />
                    )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error bar */}
      {error && (
        <div
          style={{
            padding: '0.4rem 1rem',
            borderTop: '1px solid oklch(0.65 0.22 25 / 0.3)',
          }}
        >
          <p
            style={{
              maxWidth: '48rem',
              margin: '0 auto',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.75rem',
              color: 'var(--danger)',
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          flexShrink: 0,
          padding: '0.75rem 1rem',
          borderTop: '1px solid oklch(0.98 0 0 / 0.08)',
        }}
      >
        <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            {/* Audio button */}
            <button
              onClick={recording ? stopRecording : () => void startRecording()}
              disabled={transcribing || streaming}
              title={recording ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
              style={{
                flexShrink: 0,
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: recording ? 'var(--danger)' : 'oklch(0.98 0 0 / 0.06)',
                border: `1px solid ${recording ? 'var(--danger)' : 'oklch(0.98 0 0 / 0.15)'}`,
                cursor: transcribing || streaming ? 'not-allowed' : 'pointer',
                opacity: transcribing || streaming ? 0.5 : 1,
                fontSize: '1rem',
              }}
            >
              {transcribing ? (
                <span
                  style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    background: 'var(--ink-2)',
                    animation: 'pulse 0.8s ease-in-out infinite',
                    display: 'block',
                  }}
                />
              ) : recording ? (
                '■'
              ) : (
                '🎤'
              )}
            </button>

            {/* Text input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nachricht… (Enter = Senden, Shift+Enter = Zeilenumbruch)"
              disabled={streaming}
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                borderRadius: '0.75rem',
                padding: '0.6rem 0.875rem',
                fontSize: '0.875rem',
                fontFamily: 'ui-monospace, monospace',
                background: 'oklch(0.98 0 0 / 0.06)',
                border: '1px solid oklch(0.98 0 0 / 0.15)',
                color: 'var(--ink-0)',
                minHeight: '2.5rem',
                maxHeight: '8rem',
                overflowY: 'auto',
                lineHeight: '1.5',
              }}
            />

            {/* Send / Stop button */}
            <button
              onClick={
                streaming
                  ? () => abortRef.current?.abort()
                  : () => void sendMessage()
              }
              disabled={!streaming && !input.trim()}
              style={{
                flexShrink: 0,
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: streaming ? 'var(--warn)' : 'var(--accent)',
                border: 'none',
                cursor: !streaming && !input.trim() ? 'not-allowed' : 'pointer',
                opacity: !streaming && !input.trim() ? 0.4 : 1,
                color: 'white',
                fontSize: '0.875rem',
              }}
            >
              {streaming ? '■' : '▶'}
            </button>
          </div>

          {/* Token counter */}
          {usage && (
            <div
              style={{
                marginTop: '0.4rem',
                display: 'flex',
                gap: '0.75rem',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.7rem',
                color: 'var(--ink-3)',
              }}
            >
              <span>↓ {fmtTokens(usage.cacheRead)} cache-read</span>
              <span>↑ {fmtTokens(usage.cacheWrite)} cache-write</span>
              <span>✦ {fmtTokens(usage.output)} output</span>
              {cachePercent !== null && (
                <span style={{ color: 'var(--ok)' }}>{cachePercent}% im Cache</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

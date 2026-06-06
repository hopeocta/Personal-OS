'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { TopRail } from '@/components/dashboard/TopRail'
import { MarkdownText } from '@/components/MarkdownText'
import { SKILLS } from '@/lib/config/skills'
import { VALID_CATEGORIES } from '@/lib/categories'

// ── Design tokens (cream / iOS) ───────────────────────────────────────────────
const C = {
  bg:         '#FAF8F3',
  surface:    '#FFFFFF',
  border:     '#E5E5EA',
  borderFocus:'#C7C7CC',
  text:       '#1C1C1E',
  textSub:    '#6E6E73',
  textTert:   '#AEAEB2',
  accent:     '#007AFF',
  accentBg:   'rgba(0,122,255,0.08)',
  ok:         '#34C759',
  okBg:       'rgba(52,199,89,0.1)',
  warn:       '#FF9500',
  danger:     '#FF3B30',
  seg:        '#EBEBF0',
}

const mono: React.CSSProperties = { fontFamily: 'ui-monospace, "SF Mono", monospace', fontSize: '0.72rem', letterSpacing: '0.04em' }

function iosBtn(active = false, color = C.accent): React.CSSProperties {
  return {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '0.8rem',
    fontWeight: 500,
    padding: '0.35rem 0.9rem',
    borderRadius: '10px',
    border: `1px solid ${active ? color : C.border}`,
    background: active ? color : C.surface,
    color: active ? '#FFF' : C.text,
    cursor: 'pointer',
    boxShadow: active ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
    transition: 'all 0.15s',
    userSelect: 'none' as const,
  }
}

function iosSelect(): React.CSSProperties {
  return {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '0.82rem',
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '10px',
    color: C.text,
    padding: '0.3rem 0.6rem',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    outline: 'none',
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'chat' | 'search' | 'capture'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type SearchEntry = {
  id: number
  question: string
  answer: string
  loading: boolean
  error: string
  saved: boolean
  saving: boolean
}

type UsageData = {
  cacheRead: number
  cacheWrite: number
  input: number
  output: number
}

const LERNFACH_OPTIONS = [...VALID_CATEGORIES]
const SEARCH_FILTER_OPTIONS = ['', ...VALID_CATEGORIES] as const

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── Main component ────────────────────────────────────────────────────────────

function TerminalPageInner() {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('chat')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [skillKey, setSkillKey] = useState('')
  const [lernfach, setLernfach] = useState('')
  const [docCount, setDocCount] = useState<number | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  const [searchHistory, setSearchHistory] = useState<SearchEntry[]>([])
  const [searching, setSearching] = useState(false)
  const [searchCategory, setSearchCategory] = useState('')
  const nextSearchId = useRef(0)

  const [captureCategory, setCaptureCategory] = useState('Zahnmedizin')
  const [captureSaving, setCaptureSaving] = useState(false)
  const [captureOk, setCaptureOk] = useState(false)

  const [input, setInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const searchEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hydratedRef = useRef(false)

  useEffect(() => {
    const m = searchParams.get('mode')
    if (m === 'search' || m === 'capture' || m === 'chat') setMode(m)
  }, [searchParams])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('terminal_messages')
      if (saved) setMessages(JSON.parse(saved) as ChatMessage[])
    } catch { /* ignore */ }
    setSkillKey(localStorage.getItem('terminal_skill') ?? '')
    setLernfach(localStorage.getItem('terminal_lernfach') ?? '')
    hydratedRef.current = true
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    if (messages.length > 0) localStorage.setItem('terminal_messages', JSON.stringify(messages))
    else localStorage.removeItem('terminal_messages')
  }, [messages])
  useEffect(() => { if (hydratedRef.current) localStorage.setItem('terminal_skill', skillKey) }, [skillKey])
  useEffect(() => { if (hydratedRef.current) localStorage.setItem('terminal_lernfach', lernfach) }, [lernfach])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { searchEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [searchHistory])

  useEffect(() => {
    if (!lernfach) { setDocCount(null); return }
    fetch(`/api/knowledge?category=${encodeURIComponent(lernfach)}&limit=20`)
      .then((r) => r.json())
      .then((data: unknown) => { if (Array.isArray(data)) setDocCount(data.length) })
      .catch((err) => console.error('[terminal] doc count error:', err))
  }, [lernfach])

  const clearSession = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setUsage(null)
    setError('')
    localStorage.removeItem('terminal_messages')
  }, [])

  const clearSearch = useCallback(() => {
    setSearchHistory([])
    setError('')
  }, [])

  // ── Chat send ───────────────────────────────────────────────────────────────

  async function sendChatMessage() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setError('')
    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages([...newMessages, { role: 'assistant', content: '' }])
    setStreaming(true)
    abortRef.current = new AbortController()
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, skillKey: skillKey || null, lernfach: lernfach || null }),
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
          if (sepIdx >= 0) { buffer = combined.slice(0, sepIdx); usageJson = combined.slice(sepIdx + 1); separatorFound = true }
          else buffer = combined
        }
        setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: buffer }])
      }
      if (usageJson) { try { setUsage(JSON.parse(usageJson) as UsageData) } catch { /* ignore */ } }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(msg)
      setMessages((prev) => { const last = prev[prev.length - 1]; if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1); return prev })
    } finally {
      setStreaming(false)
    }
  }

  // ── Search send ─────────────────────────────────────────────────────────────

  async function sendSearch() {
    const question = input.trim()
    if (!question || searching) return
    setInput('')
    setError('')
    const id = nextSearchId.current++
    setSearchHistory((prev) => [
      ...prev,
      { id, question, answer: '', loading: true, error: '', saved: false, saving: false },
    ])
    setSearching(true)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, category: searchCategory || undefined }),
      })
      const data = await res.json() as { text?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setSearchHistory((prev) =>
        prev.map((e) => e.id === id ? { ...e, answer: data.text ?? '', loading: false } : e),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler'
      setSearchHistory((prev) => prev.map((e) => e.id === id ? { ...e, loading: false, error: msg } : e))
      setError(msg)
    } finally {
      setSearching(false)
    }
  }

  async function saveSearchEntry(id: number) {
    const entry = searchHistory.find((e) => e.id === id)
    if (!entry?.answer || entry.saving || entry.saved) return
    setSearchHistory((prev) => prev.map((e) => (e.id === id ? { ...e, saving: true } : e)))
    try {
      const res = await fetch('/api/terminal/save-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: entry.question, answer: entry.answer, category: searchCategory || 'Allgemein' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSearchHistory((prev) => prev.map((e) => (e.id === id ? { ...e, saving: false, saved: true } : e)))
    } catch (err) {
      console.error('[terminal] save search:', err)
      setError('Speichern fehlgeschlagen')
      setSearchHistory((prev) => prev.map((e) => (e.id === id ? { ...e, saving: false } : e)))
    }
  }

  async function saveCapture() {
    const text = input.trim()
    if (!text || captureSaving) return
    setCaptureSaving(true)
    setCaptureOk(false)
    setError('')
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: text, category: captureCategory, source: 'terminal_capture' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setInput('')
      setCaptureOk(true)
      setTimeout(() => setCaptureOk(false), 3000)
    } catch {
      setError('Speichern fehlgeschlagen')
    } finally {
      setCaptureSaving(false)
    }
  }

  function handleSend() {
    if (mode === 'search') void sendSearch()
    else if (mode === 'capture') void saveCapture()
    else void sendChatMessage()
  }

  // ── Audio ───────────────────────────────────────────────────────────────────

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        await transcribeBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch { setError('Mikrofon-Zugriff verweigert') }
  }

  function stopRecording() { mediaRecorderRef.current?.stop(); setRecording(false); setTranscribing(true) }

  async function transcribeBlob(blob: Blob) {
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { text: string }
      setInput((prev) => (prev ? prev + ' ' + data.text : data.text))
      textareaRef.current?.focus()
    } catch { setError('Transkription fehlgeschlagen') }
    finally { setTranscribing(false) }
  }

  // ── Save session ────────────────────────────────────────────────────────────

  async function saveSession() {
    if (messages.length === 0 || saving) return
    setSaving(true); setSavedOk(false)
    const sessionText = messages.map((m) => `[${m.role === 'user' ? 'Ich' : 'Claude'}]\n${m.content}`).join('\n\n---\n\n')
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: sessionText, source: 'chat_session', category: lernfach || undefined }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSavedOk(true); setTimeout(() => setSavedOk(false), 3000)
    } catch { setError('Speichern fehlgeschlagen') }
    finally { setSaving(false) }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const busy = streaming || searching || transcribing || captureSaving
  const cachePercent = usage && usage.cacheRead > 0
    ? Math.round((100 * usage.cacheRead) / (usage.cacheRead + usage.cacheWrite + usage.input))
    : null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <TopRail />

      {/* Controls bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.5rem 1rem',
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
        flexWrap: 'wrap',
      }}>

        {/* Mode toggle — iOS segmented control */}
        <div style={{
          display: 'flex', background: C.seg, borderRadius: '10px',
          padding: '3px', gap: '2px', flexShrink: 0,
        }}>
          {(['chat', 'search', 'capture'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              style={{
                ...mono,
                padding: '0.25rem 0.7rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: mode === m ? 600 : 400,
                background: mode === m ? C.surface : 'transparent',
                color: mode === m ? C.text : C.textSub,
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'chat' ? 'CHAT' : m === 'search' ? 'SUCHEN' : 'ERFASSEN'}
            </button>
          ))}
        </div>

        {/* Chat controls */}
        {mode === 'chat' && (
          <>
            <div style={{ width: '1px', height: '20px', background: C.border, flexShrink: 0 }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ ...mono, color: C.textSub }}>SKILL</span>
              <select value={skillKey} onChange={(e) => { setSkillKey(e.target.value); clearSession() }} style={iosSelect()}>
                <option value="">Kein Skill</option>
                {Object.entries(SKILLS).map(([key, skill]) => <option key={key} value={key}>{skill.label}</option>)}
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ ...mono, color: C.textSub }}>LERNFACH</span>
              <select value={lernfach} onChange={(e) => { setLernfach(e.target.value); clearSession() }} style={iosSelect()}>
                <option value="">Kein Kontext</option>
                {LERNFACH_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            {lernfach && docCount !== null && (
              <span style={{
                ...mono,
                padding: '0.2rem 0.7rem', borderRadius: '20px',
                background: docCount > 0 ? C.okBg : C.seg,
                color: docCount > 0 ? C.ok : C.textTert,
                border: `1px solid ${docCount > 0 ? 'rgba(52,199,89,0.3)' : C.border}`,
                fontSize: '0.7rem',
              }}>
                {docCount > 0 ? `${docCount} im Kontext` : 'Keine Dokumente'}
              </span>
            )}
          </>
        )}

        {/* Search filter */}
        {mode === 'search' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ ...mono, color: C.textSub }}>FILTER</span>
            <select value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)} style={iosSelect()}>
              <option value="">Alle Kategorien</option>
              {SEARCH_FILTER_OPTIONS.filter(Boolean).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        )}

        {/* Capture category */}
        {mode === 'capture' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ ...mono, color: C.textSub }}>KATEGORIE</span>
            <select value={captureCategory} onChange={(e) => setCaptureCategory(e.target.value)} style={iosSelect()}>
              {LERNFACH_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {captureOk && <span style={{ ...mono, color: C.ok, fontSize: '0.7rem' }}>GESPEICHERT ✓</span>}
          </label>
        )}

        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        {mode === 'chat' && messages.length > 0 && (
          <>
            <button onClick={() => void saveSession()} disabled={saving} style={{
              ...iosBtn(false),
              color: savedOk ? C.ok : C.textSub,
              borderColor: savedOk ? 'rgba(52,199,89,0.4)' : C.border,
            }}>
              {savedOk ? 'Gespeichert ✓' : saving ? '…' : 'Speichern'}
            </button>
            <button onClick={clearSession} style={{ ...iosBtn(false), color: C.textSub }}>
              Leeren
            </button>
          </>
        )}
        {mode === 'search' && searchHistory.length > 0 && (
          <button onClick={clearSearch} style={{ ...iosBtn(false), color: C.textSub }}>Leeren</button>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1rem' }}>

        {/* ── Chat mode ── */}
        {mode === 'chat' && (
          messages.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', opacity: 0.25, marginBottom: '0.75rem' }}>💬</div>
                <p style={{ fontFamily: '-apple-system, sans-serif', fontSize: '0.9rem', color: C.textSub }}>
                  {lernfach ? `${lernfach} geladen — stell eine Frage` : 'Schreib etwas oder wähle ein Lernfach'}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    padding: '0.7rem 1rem',
                    fontSize: '0.875rem', lineHeight: '1.6',
                    background: msg.role === 'user' ? C.accent : C.surface,
                    color: msg.role === 'user' ? '#FFF' : C.text,
                    border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    wordBreak: 'break-word',
                  }}>
                    {msg.role === 'assistant' ? (
                      <MarkdownText text={msg.content || '…'} />
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                    )}
                    {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                      <span style={{
                        display: 'inline-block', width: '0.45rem', height: '0.9rem',
                        marginLeft: '0.15rem', background: C.accent, borderRadius: '2px',
                        verticalAlign: 'text-bottom', animation: 'pulse 1s ease-in-out infinite',
                      }} />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )
        )}

        {/* ── Capture mode ── */}
        {mode === 'capture' && (
          <div style={{ maxWidth: '40rem', margin: '0 auto', paddingTop: '1rem' }}>
            <p style={{ ...mono, color: C.textSub, marginBottom: '0.75rem' }}>
              Text dumpen → kategorisiert in Supabase + Obsidian.
            </p>
          </div>
        )}

        {/* ── Search mode ── */}
        {mode === 'search' && (
          searchHistory.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', opacity: 0.25, marginBottom: '0.75rem' }}>🔍</div>
                <p style={{ fontFamily: '-apple-system, sans-serif', fontSize: '0.9rem', color: C.textSub }}>
                  Stell eine Frage — ich durchsuche alles
                </p>
                <p style={{ fontFamily: '-apple-system, sans-serif', fontSize: '0.8rem', color: C.textTert, marginTop: '0.3rem' }}>
                  Garmin · Schlaf · Notizen · Wissen · Gesundheit
                </p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '52rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {searchHistory.map((entry) => (
                <div key={entry.id} style={{ background: C.surface, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  {/* Question */}
                  <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                    <span style={{ ...mono, fontSize: '0.65rem', color: C.accent, padding: '0.15rem 0.5rem', border: `1px solid rgba(0,122,255,0.3)`, borderRadius: '6px', flexShrink: 0, marginTop: '0.15rem', background: C.accentBg }}>FRAGE</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: C.text, lineHeight: '1.4' }}>{entry.question}</span>
                  </div>
                  {/* Answer */}
                  <div style={{ padding: '0.875rem 1rem' }}>
                    {entry.loading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {[0, 1, 2].map((j) => (
                          <span key={j} style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.accent, display: 'inline-block', animation: 'pulse 1s ease-in-out infinite', animationDelay: `${j * 0.2}s` }} />
                        ))}
                        <span style={{ ...mono, color: C.textTert }}>Suche…</span>
                      </div>
                    ) : entry.error ? (
                      <p style={{ ...mono, color: C.danger }}>{entry.error}</p>
                    ) : (
                      <>
                        <div style={{ fontSize: '0.875rem', color: C.text, lineHeight: '1.6' }}>
                          <MarkdownText text={entry.answer} />
                        </div>
                        <div style={{ marginTop: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => void saveSearchEntry(entry.id)}
                            disabled={entry.saving || entry.saved}
                            style={{
                              ...iosBtn(false),
                              fontSize: '0.75rem',
                              color: entry.saved ? C.ok : C.textSub,
                              borderColor: entry.saved ? 'rgba(52,199,89,0.4)' : C.border,
                              padding: '0.2rem 0.7rem',
                            }}
                          >
                            {entry.saved ? 'Im Logbuch ✓' : entry.saving ? '…' : 'Speichern'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={searchEndRef} />
            </div>
          )
        )}
      </div>

      {/* Error bar */}
      {error && (
        <div style={{ padding: '0.4rem 1rem', background: 'rgba(255,59,48,0.06)', borderTop: `1px solid rgba(255,59,48,0.2)` }}>
          <p style={{ maxWidth: '48rem', margin: '0 auto', ...mono, color: C.danger }}>{error}</p>
        </div>
      )}

      {/* Input area */}
      <div style={{ flexShrink: 0, padding: '0.75rem 1rem', borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>

            {/* Audio button */}
            <button
              onClick={recording ? stopRecording : () => void startRecording()}
              disabled={busy && !recording}
              title={recording ? 'Aufnahme stoppen' : 'Spracheingabe'}
              style={{
                flexShrink: 0, width: '2.4rem', height: '2.4rem', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: recording ? C.danger : C.surface,
                border: `1px solid ${recording ? C.danger : C.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                cursor: (busy && !recording) ? 'not-allowed' : 'pointer',
                opacity: (busy && !recording) ? 0.4 : 1, fontSize: '1rem',
              }}>
              {transcribing
                ? <span style={{ width: '0.45rem', height: '0.45rem', borderRadius: '50%', background: C.textSub, animation: 'pulse 0.8s ease-in-out infinite', display: 'block' }} />
                : recording ? '■' : '🎤'}
            </button>

            {/* Text input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'search' ? 'Frage stellen… (Enter = Suchen)'
                  : mode === 'capture' ? 'Text dumpen… (Enter = Speichern)'
                  : 'Nachricht… (Enter = Senden, Shift+Enter = Zeilenumbruch)'
              }
              disabled={streaming || searching || captureSaving}
              rows={1}
              style={{
                flex: 1, resize: 'none', borderRadius: '12px',
                padding: '0.6rem 0.875rem', fontSize: '0.875rem',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                background: C.bg,
                border: `1px solid ${C.border}`,
                color: C.text, minHeight: '2.4rem', maxHeight: '8rem',
                overflowY: 'auto', lineHeight: '1.5',
                outline: 'none',
              }}
            />

            {/* Send / Stop */}
            <button
              onClick={streaming ? () => abortRef.current?.abort() : handleSend}
              disabled={!streaming && !searching && (!input.trim() || captureSaving)}
              style={{
                flexShrink: 0, width: '2.4rem', height: '2.4rem', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: mode === 'search'
                  ? (searching ? C.warn : C.accent)
                  : mode === 'capture'
                    ? (captureSaving ? C.warn : C.ok)
                    : (streaming ? C.warn : C.accent),
                border: 'none',
                cursor: (busy && !streaming && !searching) || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: (busy && !streaming && !searching) || !input.trim() ? 0.35 : 1,
                color: 'white', fontSize: mode === 'search' ? '1rem' : '0.875rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}>
              {mode === 'search' ? (searching ? '■' : '🔍')
                : mode === 'capture' ? (captureSaving ? '…' : '💾')
                : (streaming ? '■' : '▶')}
            </button>
          </div>

          {/* Token counter */}
          {mode === 'chat' && usage && (
            <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.75rem', ...mono, color: C.textTert }}>
              <span>↓ {fmtTokens(usage.cacheRead)} cache-read</span>
              <span>↑ {fmtTokens(usage.cacheWrite)} cache-write</span>
              <span>✦ {fmtTokens(usage.output)} output</span>
              {cachePercent !== null && <span style={{ color: C.ok }}>{cachePercent}% im Cache</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TerminalPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', background: '#FAF8F3' }} />}>
      <TerminalPageInner />
    </Suspense>
  )
}

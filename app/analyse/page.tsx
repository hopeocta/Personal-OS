'use client'

import { useState, useRef, useEffect } from 'react'
import { TopRail } from '@/components/dashboard/TopRail'

const WEEK_OPTIONS = [4, 8, 12, 52] as const
type Weeks = (typeof WEEK_OPTIONS)[number]

type EinkaufData = {
  list: string
  avgKcal: number | null
  avgProtein: number | null
}

type RecentReview = {
  id: string
  summary: string
  period: string
  label: string
  obsidianPath: string
  createdAt: string
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: { content: React.ReactNode; key: string }[] = []
  let keyCounter = 0

  const flushList = () => {
    if (!listItems.length) return
    elements.push(
      <ul key={`ul-${keyCounter++}`} className="list-disc list-inside space-y-1 ml-2 mb-3">
        {listItems.map((item) => (
          <li key={item.key} style={{ color: 'var(--ink-1)' }}>
            {item.content}
          </li>
        ))}
      </ul>
    )
    listItems = []
  }

  const parseBold = (line: string): React.ReactNode => {
    const parts = line.split(/\*\*(.+?)\*\*/)
    if (parts.length === 1) return line
    return parts.map((part, j) =>
      j % 2 === 0 ? (
        part
      ) : (
        <strong key={j} style={{ color: 'var(--ink-0)' }}>
          {part}
        </strong>
      )
    )
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h2
          key={`h2-${i}`}
          style={{ color: 'var(--accent)' }}
          className="text-base font-bold font-mono tracking-wide mt-6 mb-2 first:mt-0"
        >
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h3
          key={`h3-${i}`}
          style={{ color: 'var(--ink-0)' }}
          className="font-semibold mt-4 mb-1"
        >
          {line.slice(4)}
        </h3>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push({ content: parseBold(line.slice(2)), key: `li-${i}` })
    } else if (line.trim() === '') {
      flushList()
    } else {
      flushList()
      elements.push(
        <p key={`p-${i}`} style={{ color: 'var(--ink-1)' }} className="mb-1 leading-relaxed">
          {parseBold(line)}
        </p>
      )
    }
  }
  flushList()

  return <div>{elements}</div>
}

export default function AnalysePage() {
  const [weeks, setWeeks] = useState<Weeks>(8)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState('')
  const [analyseError, setAnalyseError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([])
  const [runningReview, setRunningReview] = useState(false)
  const [runReviewMsg, setRunReviewMsg] = useState('')

  const [loadingEinkauf, setLoadingEinkauf] = useState(false)
  const [einkauf, setEinkauf] = useState<EinkaufData | null>(null)
  const [einkaufError, setEinkaufError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/analyse/recent')
      .then((r) => r.json())
      .then((d) => { if (d.reviews) setRecentReviews(d.reviews) })
      .catch(() => {})
  }, [])

  async function runMonthlyReview() {
    setRunningReview(true)
    setRunReviewMsg('')
    try {
      const res = await fetch('/api/health-review/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'monthly' }) })
      const d = await res.json()
      setRunReviewMsg(res.ok ? '✅ Monatsanalyse erstellt — schau in Telegram & Obsidian' : `❌ ${d.error ?? 'Fehler'}`)
      if (res.ok) {
        // Reviews neu laden
        const r = await fetch('/api/analyse/recent').then((r) => r.json())
        if (r.reviews) setRecentReviews(r.reviews)
      }
    } catch {
      setRunReviewMsg('❌ Netzwerkfehler')
    } finally {
      setRunningReview(false)
    }
  }

  async function startAnalyse() {
    setAnalyzing(true)
    setResult('')
    setAnalyseError('')
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Kein Stream erhalten')

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setResult((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setAnalyseError(msg)
      console.error('[analyse]', err)
    } finally {
      setAnalyzing(false)
    }
  }

  function stopAnalyse() {
    abortRef.current?.abort()
    setAnalyzing(false)
  }

  async function generateEinkaufsliste() {
    setLoadingEinkauf(true)
    setEinkauf(null)
    setEinkaufError('')

    try {
      const res = await fetch('/api/analyse/einkauf', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
      setEinkauf(data as EinkaufData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setEinkaufError(msg)
      console.error('[einkauf]', err)
    } finally {
      setLoadingEinkauf(false)
    }
  }

  function copyEinkauf() {
    if (!einkauf) return
    navigator.clipboard.writeText(einkauf.list).catch((e) => console.error('[copy]', e))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink-4)' }}>
      <TopRail />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1
            className="text-2xl font-mono font-bold tracking-widest"
            style={{ color: 'var(--ink-0)' }}
          >
            ANALYSE
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>
            Korrelationsanalyse via Claude Sonnet — Daten werden wöchentlich aggregiert
          </p>
        </div>

        {/* Letzte Reviews */}
        <div
          className="rounded-xl p-6 mb-6"
          style={{ background: 'oklch(0.98 0 0 / 0.04)', border: '1px solid oklch(0.98 0 0 / 0.1)', backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-mono font-bold tracking-wide" style={{ color: 'var(--ink-0)' }}>LETZTE REVIEWS</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>Automatische Periodenberichte — monatlich, halbjährlich, jährlich</p>
            </div>
            <button
              onClick={runMonthlyReview}
              disabled={runningReview}
              className="px-3 py-1.5 text-xs font-mono rounded transition-all disabled:opacity-50"
              style={{ background: 'oklch(0.98 0 0 / 0.08)', color: 'var(--ink-1)', border: '1px solid oklch(0.98 0 0 / 0.15)' }}
            >
              {runningReview ? '⏳ läuft...' : '▶ Monatsbericht jetzt'}
            </button>
          </div>
          {runReviewMsg && <p className="text-sm font-mono mb-3" style={{ color: runReviewMsg.startsWith('✅') ? 'var(--accent)' : 'var(--danger)' }}>{runReviewMsg}</p>}
          {recentReviews.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Noch keine automatischen Reviews vorhanden.</p>
          ) : (
            <div className="space-y-3">
              {recentReviews.map((r) => (
                <div key={r.id} className="rounded-lg px-4 py-3" style={{ background: 'oklch(0.98 0 0 / 0.04)', border: '1px solid oklch(0.98 0 0 / 0.08)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-mono font-bold" style={{ color: 'var(--ink-0)' }}>{r.summary}</p>
                      <p className="text-xs mt-1 font-mono" style={{ color: 'var(--ink-3)' }}>
                        📁 {r.obsidianPath}
                      </p>
                    </div>
                    <span className="text-xs font-mono shrink-0" style={{ color: 'var(--ink-3)' }}>
                      {new Date(r.createdAt).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls card */}
        <div
          className="rounded-xl p-6 mb-6"
          style={{
            background: 'oklch(0.98 0 0 / 0.04)',
            border: '1px solid oklch(0.98 0 0 / 0.1)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="text-sm font-mono" style={{ color: 'var(--ink-2)' }}>
              ZEITRAUM
            </span>
            {WEEK_OPTIONS.map((w) => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                className="px-4 py-1.5 rounded text-sm font-mono transition-all"
                style={{
                  background: weeks === w ? 'var(--accent)' : 'transparent',
                  color: weeks === w ? 'white' : 'var(--ink-2)',
                  border: weeks === w ? 'none' : '1px solid oklch(0.98 0 0 / 0.2)',
                }}
              >
                {w === 52 ? '1 JAHR' : `${w} WOCHEN`}
              </button>
            ))}
          </div>

          {analyzing ? (
            <button
              onClick={stopAnalyse}
              className="w-full py-4 rounded-lg font-mono font-bold text-base tracking-widest transition-all"
              style={{ background: 'var(--warn)', color: 'oklch(0.15 0 0)' }}
            >
              ■ ABBRECHEN (analysiert {weeks * 7} Tage...)
            </button>
          ) : (
            <button
              onClick={startAnalyse}
              className="w-full py-4 rounded-lg font-mono font-bold text-base tracking-widest transition-all hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              ▶ ANALYSE STARTEN
            </button>
          )}

          {analyseError && (
            <p className="mt-3 text-sm font-mono" style={{ color: 'var(--danger)' }}>
              Fehler: {analyseError}
            </p>
          )}
        </div>

        {/* Streaming result */}
        {(result || (analyzing && !result)) && (
          <div
            className="rounded-xl p-6 mb-6"
            style={{
              background: 'oklch(0.98 0 0 / 0.04)',
              border: '1px solid oklch(0.98 0 0 / 0.1)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {analyzing && !result && (
              <div className="flex items-center gap-3 mb-4" style={{ color: 'var(--ink-2)' }}>
                <span
                  className="inline-block w-2 h-2 rounded-full animate-pulse"
                  style={{ background: 'var(--accent)' }}
                />
                <span className="font-mono text-sm">Claude analysiert Daten...</span>
              </div>
            )}
            {result && <SimpleMarkdown text={result} />}
            {analyzing && result && (
              <span
                className="inline-block w-2 h-2 rounded-full animate-pulse ml-1"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </div>
        )}

        {/* Einkaufsliste card */}
        <div
          className="rounded-xl p-6"
          style={{
            background: 'oklch(0.98 0 0 / 0.04)',
            border: '1px solid oklch(0.98 0 0 / 0.1)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className="font-mono font-bold tracking-wide"
                style={{ color: 'var(--ink-0)' }}
              >
                EINKAUFSLISTE
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>
                Claude Haiku — basierend auf deinen Ernährungszielen (2500 kcal, 160g Protein)
              </p>
            </div>
            {einkauf && (
              <button
                onClick={copyEinkauf}
                className="px-3 py-1.5 text-xs font-mono rounded transition-all"
                style={{
                  border: '1px solid oklch(0.98 0 0 / 0.2)',
                  color: copied ? 'var(--ok)' : 'var(--ink-2)',
                }}
              >
                {copied ? 'KOPIERT ✓' : 'KOPIEREN'}
              </button>
            )}
          </div>

          {einkauf && (einkauf.avgKcal != null || einkauf.avgProtein != null) && (
            <div className="flex gap-4 mb-4 text-xs font-mono" style={{ color: 'var(--ink-2)' }}>
              {einkauf.avgKcal != null && (
                <span>
                  ∅ {einkauf.avgKcal} kcal/Tag{' '}
                  <span
                    style={{
                      color:
                        einkauf.avgKcal >= 2300 && einkauf.avgKcal <= 2700
                          ? 'var(--ok)'
                          : 'var(--warn)',
                    }}
                  >
                    (Ziel: 2500)
                  </span>
                </span>
              )}
              {einkauf.avgProtein != null && (
                <span>
                  ∅ {einkauf.avgProtein}g Protein/Tag{' '}
                  <span
                    style={{
                      color: einkauf.avgProtein >= 140 ? 'var(--ok)' : 'var(--warn)',
                    }}
                  >
                    (Ziel: 160g)
                  </span>
                </span>
              )}
            </div>
          )}

          <button
            onClick={generateEinkaufsliste}
            disabled={loadingEinkauf}
            className="w-full py-3 rounded-lg font-mono font-bold tracking-widest text-sm transition-all hover:opacity-90 disabled:opacity-50 mb-4"
            style={{ background: 'var(--ok)', color: 'oklch(0.15 0 0)' }}
          >
            {loadingEinkauf ? 'GENERIERT...' : 'EINKAUFSLISTE GENERIEREN'}
          </button>

          {einkaufError && (
            <p className="mb-3 text-sm font-mono" style={{ color: 'var(--danger)' }}>
              Fehler: {einkaufError}
            </p>
          )}

          {einkauf && (
            <div
              className="pt-4"
              style={{ borderTop: '1px solid oklch(0.98 0 0 / 0.08)' }}
            >
              <SimpleMarkdown text={einkauf.list} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { TopRail } from '@/components/dashboard/TopRail'
import type { KnowledgeEntry } from '@/lib/types'

const CATEGORIES = [
  'Alle', 'Zahnmedizin', 'Triathlon', 'Krafttraining', 'Ernährung',
  'Musikproduktion', 'FL Studio', 'Sampling', 'Allgemein',
]

// Full oklch strings so we can derive alpha variants without CSS variable tricks
const CAT_COLOR: Record<string, string> = {
  Zahnmedizin:    'oklch(0.72 0.18 250)',
  Triathlon:      'oklch(0.72 0.18 145)',
  Krafttraining:  'oklch(0.72 0.18 160)',
  Ernährung:      'oklch(0.72 0.18 120)',
  Musikproduktion:'oklch(0.65 0.18 290)',
  'FL Studio':    'oklch(0.65 0.18 310)',
  Sampling:       'oklch(0.65 0.18 330)',
  Allgemein:      'oklch(0.40 0 0)',
}

function catColor(c: string | null): string {
  return CAT_COLOR[c ?? ''] ?? 'oklch(0.40 0 0)'
}

// Return same color at reduced opacity for backgrounds
function catColorBg(c: string): string {
  const base = CAT_COLOR[c] ?? 'oklch(0.98 0 0)'
  // base ends with ')' → insert ' / 0.15' before closing paren
  return base.slice(0, -1) + ' / 0.15)'
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export default function WissenPage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ category: string; tags: string[] } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadEntries = useCallback(async (cat: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (cat !== 'Alle') params.set('category', cat)
      const res = await fetch(`/api/knowledge?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEntries(data)
    } catch (err) {
      console.error('[wissen] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEntries(activeCategory)
  }, [activeCategory, loadEntries])

  const handleSave = async () => {
    if (!text.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: text.trim() }),
      })
      const entry: KnowledgeEntry = await res.json()
      if (!res.ok) throw new Error((entry as { error?: string }).error)

      setText('')
      if (toastTimer.current) clearTimeout(toastTimer.current)
      setToast({ category: entry.category ?? 'Allgemein', tags: entry.tags ?? [] })
      toastTimer.current = setTimeout(() => setToast(null), 4000)

      // Reload entries — if we're filtered to a different category, switch to matching one
      if (activeCategory === 'Alle' || activeCategory === entry.category) {
        setEntries((prev) => [entry, ...prev])
      } else {
        setActiveCategory('Alle')
      }
    } catch (err) {
      console.error('[wissen] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const filtered = entries.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.raw_text.toLowerCase().includes(q) ||
      (e.summary ?? '').toLowerCase().includes(q) ||
      (e.tags ?? []).some((t) => t.toLowerCase().includes(q))
    )
  })

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  return (
    <>
      <TopRail />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '4.5rem', right: '1.5rem', zIndex: 50,
          background: 'oklch(0.18 0 0)',
          border: '1px solid oklch(0.98 0 0 / 0.12)',
          borderLeft: `3px solid ${catColor(toast.category)}`,
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.8rem',
          color: 'var(--ink-1)',
          boxShadow: '0 4px 24px oklch(0 0 0 / 0.4)',
          maxWidth: '320px',
        }}>
          <div style={{ color: catColor(toast.category), fontWeight: 600, marginBottom: '0.25rem' }}>
            ✓ Gespeichert — {toast.category}
          </div>
          {toast.tags.length > 0 && (
            <div style={{ color: 'var(--ink-2)' }}>{toast.tags.join(' · ')}</div>
          )}
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Capture section */}
        <div style={{
          background: 'oklch(0.15 0 0 / 0.6)',
          border: '1px solid oklch(0.98 0 0 / 0.08)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          backdropFilter: 'blur(8px)',
        }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Hier dumpen — Recherche, Erkenntnisse, Ideen, alles..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave()
            }}
            style={{
              width: '100%',
              minHeight: '100px',
              background: 'oklch(0.10 0 0 / 0.6)',
              border: '1px solid oklch(0.98 0 0 / 0.08)',
              borderRadius: '8px',
              padding: '0.75rem',
              color: 'var(--ink-0)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.875rem',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: 'var(--ink-3)' }}>
              Ctrl+Enter zum Speichern
            </span>
            <button
              onClick={handleSave}
              disabled={!text.trim() || saving}
              style={{
                background: saving ? 'oklch(0.30 0 0)' : 'var(--accent)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 1.5rem',
                color: saving ? 'var(--ink-2)' : 'oklch(0.10 0 0)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                cursor: saving || !text.trim() ? 'not-allowed' : 'pointer',
                opacity: !text.trim() ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
            >
              {saving ? 'CLAUDE KATEGORISIERT...' : 'SPEICHERN'}
            </button>
          </div>
        </div>

        {/* Filter + Search */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', flex: 1 }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  background: activeCategory === cat
                    ? (cat === 'Alle' ? 'oklch(0.98 0 0 / 0.10)' : catColorBg(cat))
                    : 'transparent',
                  border: `1px solid ${activeCategory === cat
                    ? (cat === 'Alle' ? 'oklch(0.98 0 0 / 0.20)' : catColor(cat))
                    : 'oklch(0.98 0 0 / 0.08)'}`,
                  borderRadius: '6px',
                  padding: '0.35rem 0.7rem',
                  color: activeCategory === cat && cat !== 'Alle' ? catColor(cat) : 'var(--ink-1)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  transition: 'all 0.12s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen..."
            style={{
              background: 'oklch(0.10 0 0 / 0.6)',
              border: '1px solid oklch(0.98 0 0 / 0.08)',
              borderRadius: '8px',
              padding: '0.4rem 0.75rem',
              color: 'var(--ink-0)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.8rem',
              outline: 'none',
              width: '180px',
            }}
          />
        </div>

        {/* Entry count */}
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
          {loading ? 'LADEN...' : `${filtered.length} EINTRÄGE`}
        </div>

        {/* Entries */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--ink-3)', fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
            LADEN...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--ink-3)', fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
            {search ? 'KEINE TREFFER' : 'NOCH NICHTS GESPEICHERT'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map((entry) => {
              const isOpen = expanded.has(entry.id)
              return (
                <div
                  key={entry.id}
                  onClick={() => toggleExpand(entry.id)}
                  style={{
                    background: 'oklch(0.15 0 0 / 0.6)',
                    border: '1px solid oklch(0.98 0 0 / 0.08)',
                    borderLeft: `3px solid ${catColor(entry.category)}`,
                    borderRadius: '8px',
                    padding: '0.875rem 1rem',
                    cursor: 'pointer',
                    transition: 'border-color 0.12s',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginBottom: isOpen ? '0.625rem' : 0 }}>
                    {/* Category badge */}
                    <span style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.65rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: catColor(entry.category) + '22',
                      color: catColor(entry.category),
                      letterSpacing: '0.06em',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {entry.category ?? 'ALLGEMEIN'}
                    </span>

                    {/* Summary */}
                    <span style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.82rem',
                      color: 'var(--ink-0)',
                      flex: 1,
                      lineHeight: 1.45,
                    }}>
                      {entry.summary ?? entry.raw_text.slice(0, 100)}
                    </span>

                    {/* Right side: date + chevron */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-3)' }}>
                        {formatDate(entry.created_at)}
                      </span>
                      <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
                        ▾
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  {entry.tags && entry.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: isOpen ? 0 : '0.5rem' }}>
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: 'oklch(0.98 0 0 / 0.06)',
                            color: 'var(--ink-2)',
                            border: '1px solid oklch(0.98 0 0 / 0.08)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expanded raw text */}
                  {isOpen && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid oklch(0.98 0 0 / 0.06)',
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.8rem',
                        color: 'var(--ink-2)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {entry.raw_text}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

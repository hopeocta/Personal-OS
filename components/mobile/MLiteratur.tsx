'use client'
import { useState } from 'react'
import type { LiteraturEntry } from '@/lib/types'

const THEMA_ORDER = ['Implantologie', 'Parodontologie', 'Endodontie', 'Oralchirurgie', 'Allgemein']

function getThema(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('implant')) return 'Implantologie'
  if (t.includes('periodont') || t.includes('gingiv') || t.includes('perio')) return 'Parodontologie'
  if (t.includes('endodont') || t.includes('root canal') || t.includes('pulp')) return 'Endodontie'
  if (t.includes('surgery') || t.includes('surgical') || t.includes('maxillofac') || t.includes('oral surg')) return 'Oralchirurgie'
  return 'Allgemein'
}

function groupByThema(articles: LiteraturEntry[]): [string, LiteraturEntry[]][] {
  const map: Record<string, LiteraturEntry[]> = {}
  for (const a of articles) {
    const thema = getThema(a.title)
    if (!map[thema]) map[thema] = []
    map[thema].push(a)
  }
  return THEMA_ORDER.filter((t) => map[t]?.length).map((t) => [t, map[t]])
}

export function MLiteratur({ articles, kw, year }: { articles: LiteraturEntry[]; kw: number; year: number }) {
  const [open, setOpen] = useState(false)
  const [openThemen, setOpenThemen] = useState<Record<string, boolean>>({})

  if (articles.length === 0) return null

  const grouped = groupByThema(articles)

  const toggleThema = (thema: string) =>
    setOpenThemen((prev) => ({ ...prev, [thema]: !prev[thema] }))

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="panel-label" style={{ margin: 0 }}>LITERATUR</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 4,
              padding: '1px 5px',
              letterSpacing: '0.05em',
            }}
          >
            KW {kw}/{year}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--ink-3)',
              letterSpacing: '0.05em',
            }}
          >
            {articles.length} Artikel
          </span>
        </div>
        <span style={{ color: 'var(--ink-3)', fontSize: '0.75rem' }}>{open ? '▾' : '▸'}</span>
      </button>

      {/* Body */}
      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grouped.map(([thema, arts]) => (
            <div key={thema} style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              {/* Topic header */}
              <button
                onClick={() => toggleThema(thema)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  marginBottom: openThemen[thema] ? 8 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.62rem',
                      letterSpacing: '0.08em',
                      color: 'var(--ink-2)',
                      fontWeight: 600,
                    }}
                  >
                    {thema.toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.58rem',
                      color: 'var(--ink-3)',
                    }}
                  >
                    ({arts.length})
                  </span>
                </div>
                <span style={{ color: 'var(--ink-3)', fontSize: '0.68rem' }}>
                  {openThemen[thema] ? '▾' : '▸'}
                </span>
              </button>

              {/* Articles */}
              {openThemen[thema] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {arts.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '9px 11px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          color: 'var(--ink-0)',
                          lineHeight: 1.4,
                          marginBottom: 5,
                        }}
                      >
                        {a.title}
                      </div>
                      {a.summary && (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--ink-2)',
                            lineHeight: 1.5,
                            marginBottom: 6,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical' as const,
                            overflow: 'hidden',
                          }}
                        >
                          {a.summary}
                        </div>
                      )}
                      {a.source_url && (
                        <a
                          href={a.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.6rem',
                            color: 'var(--accent)',
                            textDecoration: 'none',
                            letterSpacing: '0.04em',
                          }}
                        >
                          PUBMED →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

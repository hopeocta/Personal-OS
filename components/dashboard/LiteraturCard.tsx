'use client'
import { useState } from 'react'
import { Panel } from './Panel'
import type { LiteraturEntry } from '@/lib/types'

const THEMA_ORDER = ['MKG / Chirurgie', 'Implantologie', 'Parodontologie', 'Endodontie', 'Kiefergelenk', 'Onkologie', 'Sportmedizin', 'Allgemein']

function getThema(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('triathlon') || t.includes('endurance') || t.includes('exercise') || t.includes('sport') || t.includes('troponin') || t.includes('tendinopathy') || t.includes('rehabilitation') || t.includes('pacing')) return 'Sportmedizin'
  if (t.includes('cancer') || t.includes('carcinoma') || t.includes('tumor') || t.includes('immunotherapy') || t.includes('osteonecrosis') || t.includes('mronj') || t.includes('oncol') || t.includes('malignant') || t.includes('squamous')) return 'Onkologie'
  if (t.includes('implant')) return 'Implantologie'
  if (t.includes('periodont') || t.includes('gingiv') || t.includes('perio-implant') || t.includes('peri-implant')) return 'Parodontologie'
  if (t.includes('endodont') || t.includes('root canal') || t.includes('pulp')) return 'Endodontie'
  if (t.includes('temporomandibular') || t.includes(' tmj') || t.includes('molar') || t.includes('jaw')) return 'Kiefergelenk'
  if (t.includes('surgery') || t.includes('surgical') || t.includes('maxillofac') || t.includes('trauma') || t.includes('fracture') || t.includes('flap') || t.includes('reconstruction') || t.includes('orthognath')) return 'MKG / Chirurgie'
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

export function LiteraturCard({ articles, kw, year }: { articles: LiteraturEntry[]; kw: number; year: number }) {
  const [openThemen, setOpenThemen] = useState<Record<string, boolean>>({})

  const grouped = groupByThema(articles)
  const toggleThema = (thema: string) =>
    setOpenThemen((prev) => ({ ...prev, [thema]: !prev[thema] }))

  return (
    <Panel>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="panel-label" style={{ margin: 0 }}>LITERATUR</span>
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.6rem',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 3,
              padding: '1px 5px',
              letterSpacing: '0.05em',
            }}
          >
            KW {kw}/{year}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.6rem',
            color: 'var(--ink-3)',
          }}
        >
          {articles.length} Artikel
        </span>
      </div>

      {/* Empty state */}
      {articles.length === 0 && (
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-3)' }}>
          Noch keine Einträge — Newsletter läuft montags 07:00 UTC.
        </div>
      )}

      {/* Topic sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {grouped.map(([thema, arts], idx) => (
          <div
            key={thema}
            style={{
              borderTop: idx === 0 ? 'none' : '1px solid var(--line)',
              paddingTop: idx === 0 ? 0 : 10,
              marginTop: idx === 0 ? 0 : 6,
            }}
          >
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
                padding: '4px 0',
                cursor: 'pointer',
                marginBottom: openThemen[thema] ? 8 : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.62rem',
                    letterSpacing: '0.08em',
                    color: 'var(--ink-1)',
                    fontWeight: 600,
                  }}
                >
                  {thema.toUpperCase()}
                </span>
                <span
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.58rem',
                    color: 'var(--ink-3)',
                  }}
                >
                  ({arts.length})
                </span>
              </div>
              <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem' }}>
                {openThemen[thema] ? '▾' : '▸'}
              </span>
            </button>

            {/* Articles */}
            {openThemen[thema] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
                {arts.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      padding: '9px 12px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.8rem',
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
                          fontSize: '0.73rem',
                          color: 'var(--ink-2)',
                          lineHeight: 1.55,
                          marginBottom: 6,
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
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
                          fontFamily: 'ui-monospace, monospace',
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
    </Panel>
  )
}

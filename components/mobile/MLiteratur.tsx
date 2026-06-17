'use client'
import { useState } from 'react'
import type { LiteraturEntry, LiteraturSectionsDe } from '@/lib/types'

const SECTIONS: { key: keyof LiteraturSectionsDe; label: string }[] = [
  { key: 'hintergrund', label: 'Untersucht' },
  { key: 'methodik_ergebnisse', label: 'Methodik' },
  { key: 'schlussfolgerung', label: 'Ergebnis' },
  { key: 'fortschritt', label: 'Fortschritt' },
]

function MArticleCard({ article }: { article: LiteraturEntry }) {
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<keyof LiteraturSectionsDe>('hintergrund')
  const s = article.sections_de

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 8, padding: '9px 11px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--ink-0)', lineHeight: 1.4, flex: 1 }}>
          {article.title}
        </span>
        <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', flexShrink: 0, marginTop: 2 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '10px 11px' }}>
          {s ? (
            <>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {SECTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.06em',
                      padding: '3px 8px', borderRadius: 5,
                      border: `1px solid ${activeSection === key ? 'var(--accent)' : 'var(--line-strong)'}`,
                      background: activeSection === key ? 'rgba(192,98,59,0.1)' : 'transparent',
                      color: activeSection === key ? 'var(--accent)' : 'var(--ink-3)',
                      cursor: 'pointer',
                    }}
                  >
                    {label.toUpperCase()}
                  </button>
                ))}
              </div>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--ink-1)', margin: 0 }}>
                {s[activeSection]}
              </p>
            </>
          ) : (
            <p style={{ fontSize: '0.73rem', color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
              {article.summary ?? 'Kein Abstract verfügbar.'}
            </p>
          )}
          {article.source_url && (
            <a href={article.source_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--accent)', textDecoration: 'none', letterSpacing: '0.04em' }}>
              PUBMED →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

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
                    <MArticleCard key={a.id} article={a} />
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

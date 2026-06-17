'use client'
import { useState } from 'react'
import { Panel } from './Panel'
import type { LiteraturEntry, LiteraturSectionsDe } from '@/lib/types'

const THEMA_ORDER = ['MKG / Chirurgie', 'Implantologie', 'Parodontologie', 'Endodontie', 'Kiefergelenk', 'Onkologie', 'Sportmedizin', 'Allgemein']

const SECTIONS: { key: keyof LiteraturSectionsDe; label: string }[] = [
  { key: 'hintergrund',         label: 'Hintergrund' },
  { key: 'methodik_ergebnisse', label: 'Methodik & Ergebnisse' },
  { key: 'schlussfolgerung',    label: 'Schlussfolgerung' },
  { key: 'fortschritt',         label: 'Medizinischer Fortschritt' },
]

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

function buildPrompt(articles: LiteraturEntry[], kw: number, year: number): string {
  const lines = articles.map((a, i) =>
    `[${i + 1}] ${a.title}\n${a.summary ?? '(kein Abstract)'}`
  ).join('\n\n')
  return `Du bist mein medizinischer Assistent. Ich schicke dir ${articles.length} Abstracts aus meinem wöchentlichen Zahnmedizin-Newsletter (KW ${kw}/${year}).

Erstelle eine kompakte Synthese auf Deutsch:

## Überblick
1–2 Sätze: was dominiert diese Woche thematisch?

## Kernerkenntnisse nach Thema
Für jedes relevante Thema einen kurzen Absatz: was ist neu, was ist klinisch relevant?

## Medizinischer Fortschritt
2–4 Sätze: übergreifende Trends, was ändert sich in der Praxis?

Max. 400 Wörter.

---
${lines}`
}

function ArticleCard({ article }: { article: LiteraturEntry }) {
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<keyof LiteraturSectionsDe>('hintergrund')
  const s = article.sections_de

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 8,
        overflow: 'hidden',
        background: open ? 'rgba(255,253,248,0.8)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Titel-Zeile */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.625rem 0.75rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 500,
            color: 'var(--ink-0)',
            lineHeight: 1.4,
            flex: 1,
          }}
        >
          {article.title}
        </span>
        <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', flexShrink: 0, marginTop: 2 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '0.75rem' }}>
          {s ? (
            <>
              {/* Abschnitt-Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.375rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.75rem',
                }}
              >
                {SECTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.58rem',
                      letterSpacing: '0.06em',
                      padding: '0.25rem 0.6rem',
                      borderRadius: 5,
                      border: `1px solid ${activeSection === key ? 'var(--accent)' : 'var(--line-strong)'}`,
                      background: activeSection === key ? 'rgba(192,98,59,0.1)' : 'transparent',
                      color: activeSection === key ? 'var(--accent)' : 'var(--ink-3)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Abschnitt-Inhalt */}
              <p
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '0.8rem',
                  lineHeight: 1.75,
                  color: 'var(--ink-1)',
                  margin: 0,
                }}
              >
                {s[activeSection]}
              </p>
            </>
          ) : (
            /* Fallback: englischer Abstract */
            <p
              style={{
                fontSize: '0.73rem',
                color: 'var(--ink-2)',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {article.summary ?? 'Kein Abstract verfügbar.'}
            </p>
          )}

          {article.source_url && (
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: '0.625rem',
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
      )}
    </div>
  )
}

export function LiteraturCard({ articles, kw, year }: { articles: LiteraturEntry[]; kw: number; year: number }) {
  const [openThemen, setOpenThemen] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  const grouped = groupByThema(articles)
  const toggleThema = (thema: string) =>
    setOpenThemen((prev) => ({ ...prev, [thema]: !prev[thema] }))

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildPrompt(articles, kw, year))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--ink-3)' }}>
            {articles.length} Artikel
          </span>
          {articles.length > 0 && (
            <button
              onClick={copyPrompt}
              title="Synthese-Prompt für claude.ai kopieren"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.58rem',
                padding: '0.2rem 0.5rem',
                borderRadius: 5,
                border: `1px solid ${copied ? 'var(--ok)' : 'var(--line-strong)'}`,
                background: copied ? 'rgba(107,142,61,0.1)' : 'transparent',
                color: copied ? 'var(--ok)' : 'var(--ink-3)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? '✓ Kopiert' : '✦ Prompt'}
            </button>
          )}
        </div>
      </div>

      {articles.length === 0 && (
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-3)' }}>
          Noch keine Einträge — Newsletter läuft montags 07:00 UTC.
        </div>
      )}

      {/* Themen-Gruppen */}
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
            {/* Thema-Header */}
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
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.62rem', letterSpacing: '0.08em', color: 'var(--ink-1)', fontWeight: 600 }}>
                  {thema.toUpperCase()}
                </span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.58rem', color: 'var(--ink-3)' }}>
                  ({arts.length})
                </span>
              </div>
              <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem' }}>
                {openThemen[thema] ? '▾' : '▸'}
              </span>
            </button>

            {/* Artikel-Liste */}
            {openThemen[thema] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
                {arts.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}

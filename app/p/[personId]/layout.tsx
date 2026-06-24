'use client'
import { useEffect } from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'

const NAMES: Record<string, string> = { p1: 'Ute', p2: 'Markus', me: 'Christoph' }

// ── Nautisch (p2+): Tinte, Messing, verwittertes Pergament ───
const NAU = {
  bg:         '#0B1520',
  header:     '#080F18',
  headerText: '#C4973A',
  headerSub:  '#3D5265',
  tabActive:  '#C4973A',
  tabInact:   '#3D5265',
  tabBorder:  'rgba(196,151,58,0.3)',
  tabLine:    'rgba(255,255,255,0.06)',
  main:       '#0B1520',
  font:       "'IM Fell English SC', Georgia, serif",
}

// ── Mint (p1): behalten wie bisher ───────────────────────────
const MINT = {
  bg:         '#F2EDE4',
  header:     '#2D7A5F',
  headerText: '#FFFFFF',
  headerSub:  '#A8D5BA',
  tabActive:  '#FFFFFF',
  tabInact:   'rgba(255,255,255,0.5)',
  tabBorder:  '#A8D5BA',
  tabLine:    'rgba(255,255,255,0.15)',
  main:       '#F2EDE4',
  font:       '-apple-system, system-ui, sans-serif',
}

export default function PersonLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { personId } = useParams<{ personId: string }>()
  const name   = NAMES[personId] ?? personId
  const isDone     = pathname.endsWith('/done')
  const isProgress = pathname.endsWith('/progress')
  const t      = personId === 'p1' ? MINT : NAU
  const isNau  = personId !== 'p1'

  // Font dynamisch in <head> laden — JSX <link> wird in Client Components nicht zuverlässig gehisst
  useEffect(() => {
    if (!isNau) return
    if (document.getElementById('nau-font')) return
    const link = document.createElement('link')
    link.id = 'nau-font'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=Space+Mono:wght@400;700&display=swap'
    document.head.appendChild(link)
  }, [isNau])

  return (
    <>

      <div style={{
        minHeight: '100dvh',
        background: t.bg,
        fontFamily: t.font,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <header style={{
          background: t.header,
          padding: '1.1rem 1.4rem 1rem',
          position: 'sticky', top: 0, zIndex: 10,
          borderBottom: isNau ? '1px solid rgba(196,151,58,0.15)' : 'none',
        }}>
          {isNau && (
            <div style={{ fontSize: '0.62rem', color: t.headerSub, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 3 }}>
              Trainingstagebuch
            </div>
          )}
          {!isNau && (
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: t.headerSub, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
              Trainingsplan
            </div>
          )}
          <h1 style={{
            fontSize: isNau ? '1.5rem' : '1.35rem',
            fontWeight: isNau ? 400 : 700,
            color: t.headerText,
            margin: 0,
            letterSpacing: isNau ? '0.04em' : 0,
          }}>
            {name}
          </h1>
        </header>

        {/* Tabs: p1 oben, p2 unten */}
        {!isNau && (
          <nav style={{ background: t.header, display: 'flex', borderTop: `1px solid ${t.tabLine}` }}>
            {[
              { label: 'Anstehend',  path: `/p/${personId}` },
              { label: 'Erledigt',   path: `/p/${personId}/done` },
              { label: 'Fortschritt', path: `/p/${personId}/progress` },
            ].map(tab => {
              const active = tab.path.endsWith('/done') ? isDone : tab.path.endsWith('/progress') ? isProgress : (!isDone && !isProgress)
              return (
                <button key={tab.path} onClick={() => router.push(tab.path)} style={{
                  flex: 1, padding: '0.7rem', fontSize: '0.85rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer', background: 'none',
                  color: active ? t.tabActive : t.tabInact,
                  borderBottom: active ? `2px solid ${t.tabBorder}` : '2px solid transparent',
                }}>
                  {tab.label}
                </button>
              )
            })}
          </nav>
        )}

        <main style={{
          flex: 1, overflowY: 'auto',
          padding: isNau ? '1.2rem 1rem 5rem' : '1.2rem 1rem 2rem',
          background: t.main,
        }}>
          {children}
        </main>

        {/* Bottom-Nav nur für p2+ (nautisch) */}
        {isNau && (
          <nav style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: t.header,
            borderTop: `1px solid rgba(196,151,58,0.2)`,
            display: 'flex',
            paddingBottom: 'env(safe-area-inset-bottom)',
            zIndex: 20,
          }}>
            {[
              { label: 'Anstehend',   path: `/p/${personId}` },
              { label: 'Erledigt',    path: `/p/${personId}/done` },
              { label: 'Fortschritt', path: `/p/${personId}/progress` },
            ].map(tab => {
              const active = tab.path.endsWith('/done') ? isDone : tab.path.endsWith('/progress') ? isProgress : (!isDone && !isProgress)
              return (
                <button key={tab.path} onClick={() => router.push(tab.path)} style={{
                  flex: 1, padding: '0.75rem 0.25rem 0.5rem',
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '0.58rem', fontWeight: 400,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  border: 'none', cursor: 'pointer', background: 'none',
                  color: active ? '#C4973A' : '#3D5265',
                  borderTop: active ? '2px solid rgba(196,151,58,0.5)' : '2px solid transparent',
                }}>
                  {tab.label}
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </>
  )
}

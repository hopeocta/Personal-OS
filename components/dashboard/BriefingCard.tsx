import { Panel } from './Panel'
import { WeekSummaryButton } from './WeekSummaryButton'

type Props = { markdown: string; dateKey: string }

function extractSection(markdown: string, heading: string): string[] {
  const re = new RegExp(`## ${heading}[\\s\\S]*?(?=## |$)`)
  const match = markdown.match(re)
  if (!match) return []
  return match[0]
    .split('\n')
    .filter(l => l.startsWith('- '))
    .map(l => l.slice(2).trim())
}

function acwrLine(markdown: string): string | null {
  const m = markdown.match(/Trainingsbelastung[^:]*:\s*([^\n—]+)/)
  return m ? m[0].replace(/^\s*-\s*/, '').trim() : null
}

export function BriefingCard({ markdown, dateKey }: Props) {
  const heute   = extractSection(markdown, 'Heute')
  const heuteDran = extractSection(markdown, 'Heute dran')
  const acwr    = acwrLine(markdown)

  const allItems = [
    ...heute,
    ...(acwr ? [acwr] : []),
  ].slice(0, 6)

  const tasks = heuteDran.slice(0, 4)

  return (
    <Panel>
      <div className="panel-label">HEUTE — {dateKey}</div>

      {/* Ereignisse + ACWR */}
      {allItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0 12px' }}>
          {allItems.map((item, i) => {
            const isWarn = item.includes('⚠') || item.includes('Prüfung') || item.includes('Termin')
            const isOk   = item.includes('ACWR') || item.includes('✓')
            const col    = isWarn ? 'var(--warn)' : isOk ? 'var(--ok)' : 'var(--ink-1)'
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'baseline', gap: 8,
                padding: '5px 8px',
                background: 'var(--ink-4)', border: '1px solid var(--line)',
                borderRadius: 8,
                fontSize: '0.78rem', color: col, lineHeight: 1.4,
              }}>
                {item}
              </div>
            )
          })}
        </div>
      )}

      {/* Heutige Tasks */}
      {tasks.length > 0 && (
        <>
          <div style={{ fontSize: '0.6rem', color: 'var(--ink-3)', letterSpacing: '0.07em', marginBottom: 6 }}>
            HEUTE DRAN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
            {tasks.map((t, i) => (
              <div key={i} style={{
                fontSize: '0.78rem', color: 'var(--ink-2)',
                padding: '4px 0', borderBottom: '1px solid var(--line)',
              }}>
                {t}
              </div>
            ))}
          </div>
        </>
      )}

      {allItems.length === 0 && tasks.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginBottom: 12 }}>
          Keine Einträge für heute
        </div>
      )}

      <WeekSummaryButton />
    </Panel>
  )
}

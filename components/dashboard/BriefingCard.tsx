import { Panel } from './Panel'

type Props = {
  markdown: string
  dateKey: string
}

/** Kompakte Ansicht des Morgen-Briefings (volle Version auch per Telegram + Obsidian). */
export function BriefingCard({ markdown, dateKey }: Props) {
  const body = markdown.replace(/^#[^\n]+\n+/, '')
  const sections = body.split(/^## /m).filter(Boolean)

  return (
    <Panel>
      <div className="panel-label">BRIEFING — {dateKey}</div>
      <p style={{ fontSize: '0.7rem', color: 'var(--ink-3)', marginTop: '0.35rem', marginBottom: '0.75rem' }}>
        Täglich per Telegram (~08:00). Hier dieselbe Zusammenfassung.
      </p>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.82rem', lineHeight: 1.75, color: 'var(--ink-1)' }}>
        {sections.map((block, i) => {
          const [titleLine, ...rest] = block.split('\n')
          const title = titleLine.replace(/^#+\s*/, '').trim()
          const bullets = rest
            .filter((l) => l.startsWith('- ') || l.startsWith('**Gestern'))
            .slice(0, 6)
          if (!title) return null
          return (
            <div key={i} style={{ marginBottom: '0.65rem' }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '0.2rem' }}>
                {title.toUpperCase()}
              </div>
              {bullets.map((line, j) => (
                <div key={j} style={{ color: 'var(--ink-2)', paddingLeft: '0.25rem' }}>
                  {line.replace(/^- \*\*/, '').replace(/\*\*/g, '')}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

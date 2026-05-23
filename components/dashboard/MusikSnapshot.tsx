import Link from 'next/link'
import { Panel } from './Panel'

type ProjectStatus = 'idea' | 'wip' | 'mixing' | 'done' | 'released'

type MusicProject = {
  id: string
  title: string
  bpm?: number | null
  musicalKey?: string | null
  genre?: string | null
  status: ProjectStatus
}

type Props = { projects: MusicProject[] }

const STATUS_STYLES: Record<
  ProjectStatus,
  { bg: string; color: string; label: string }
> = {
  idea:     { bg: 'oklch(0.98 0 0 / 0.07)',     color: 'var(--ink-3)',         label: 'IDEE'     },
  wip:      { bg: 'oklch(0.72 0.18 250 / 0.2)', color: 'var(--accent)',        label: 'WIP'      },
  mixing:   { bg: 'oklch(0.75 0.18 80 / 0.2)',  color: 'var(--warn)',          label: 'MIXING'   },
  done:     { bg: 'oklch(0.72 0.18 145 / 0.2)', color: 'var(--ok)',            label: 'DONE'     },
  released: { bg: 'oklch(0.65 0.18 290 / 0.2)', color: 'oklch(0.65 0.18 290)', label: 'RELEASED' },
}

function Tag({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.6rem',
        padding: '0.15rem 0.4rem',
        borderRadius: '3px',
        background: 'oklch(0.98 0 0 / 0.07)',
        color: 'var(--ink-2)',
      }}
    >
      {children}
    </span>
  )
}

export function MusikSnapshot({ projects }: Props) {
  const visible = projects.slice(0, 3)

  return (
    <Panel>
      <div className="panel-label">MUSIK PROJEKTE</div>

      {visible.map((p, i) => {
        const s = STATUS_STYLES[p.status]
        return (
          <div
            key={p.id}
            style={{
              paddingTop: i === 0 ? 0 : '0.625rem',
              paddingBottom: i < visible.length - 1 ? '0.625rem' : 0,
              borderBottom:
                i < visible.length - 1 ? '1px solid oklch(0.98 0 0 / 0.05)' : 'none',
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--ink-0)',
                marginBottom: '0.3rem',
              }}
            >
              {p.title}
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.6rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '3px',
                  background: s.bg,
                  color: s.color,
                }}
              >
                {s.label}
              </span>
              {p.bpm != null && <Tag>{`${p.bpm} BPM`}</Tag>}
              {p.musicalKey && <Tag>{p.musicalKey}</Tag>}
              {p.genre && <Tag>{p.genre}</Tag>}
            </div>
          </div>
        )
      })}

      <div
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.625rem',
          borderTop: '1px solid oklch(0.98 0 0 / 0.06)',
          textAlign: 'right',
        }}
      >
        <Link
          href="/musik"
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.65rem',
            color: 'var(--accent)',
            textDecoration: 'none',
          }}
        >
          ALLE PROJEKTE →
        </Link>
      </div>
    </Panel>
  )
}

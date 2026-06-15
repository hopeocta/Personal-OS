import Link from 'next/link'
import { Panel } from './Panel'
import type { MusicProject } from '@/lib/types'

type ProjectStatus = 'idea' | 'wip' | 'mixing' | 'done' | 'released'

type Props = { projects: MusicProject[] }

const STATUS_STYLES: Record<
  ProjectStatus,
  { bg: string; color: string; label: string }
> = {
  idea:     { bg: '#EFE7D6',     color: 'var(--ink-3)',         label: 'IDEE'     },
  wip:      { bg: '#F3E0D5', color: 'var(--accent)',        label: 'WIP'      },
  mixing:   { bg: '#F5E8CC',  color: 'var(--warn)',          label: 'MIXING'   },
  done:     { bg: '#E6EDD6', color: 'var(--ok)',            label: 'DONE'     },
  released: { bg: '#EAE0EE', color: '#7E5A86', label: 'RELEASED' },
}

function Tag({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.6rem',
        padding: '0.15rem 0.4rem',
        borderRadius: '3px',
        background: '#EFE7D6',
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
                i < visible.length - 1 ? '1px solid var(--line)' : 'none',
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
              {p.musical_key && <Tag>{p.musical_key}</Tag>}
              {p.genre && <Tag>{p.genre}</Tag>}
            </div>
          </div>
        )
      })}

      <div
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.625rem',
          borderTop: '1px solid var(--line)',
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

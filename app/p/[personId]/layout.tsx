'use client'
import { usePathname, useRouter, useParams } from 'next/navigation'

const NAMES: Record<string, string> = { p1: 'Ute', p2: 'Arthur' }

export default function PersonLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { personId } = useParams<{ personId: string }>()
  const name = NAMES[personId] ?? personId
  const isDone = pathname.endsWith('/done')

  return (
    <div style={{ minHeight: '100dvh', background: '#F2EDE4', fontFamily: '-apple-system, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: '#2D7A5F',
        padding: '1.1rem 1.4rem 1rem',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#A8D5BA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Trainingsplan</div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{name}</h1>
      </header>

      {/* Tabs */}
      <nav style={{ background: '#2D7A5F', display: 'flex', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
        {[
          { label: 'Anstehend', path: `/p/${personId}` },
          { label: 'Erledigt',  path: `/p/${personId}/done` },
        ].map(tab => {
          const active = tab.path.endsWith('/done') ? isDone : !isDone
          return (
            <button key={tab.path} onClick={() => router.push(tab.path)} style={{
              flex: 1, padding: '0.7rem', fontSize: '0.95rem', fontWeight: 600,
              border: 'none', cursor: 'pointer', background: 'none',
              color: active ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
              borderBottom: active ? '2.5px solid #A8D5BA' : '2.5px solid transparent',
            }}>
              {tab.label}
            </button>
          )
        })}
      </nav>

      <main style={{ flex: 1, overflowY: 'auto', padding: '1.2rem 1rem 2rem' }}>
        {children}
      </main>
    </div>
  )
}

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
    <div style={{ minHeight: '100dvh', background: '#f0f4f8', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.9rem 1.2rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a2332', margin: 0 }}>🏃 {name}s Trainingsplan</h1>
      </header>

      <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex' }}>
        {[
          { label: 'Anstehend', path: `/p/${personId}` },
          { label: 'Erledigt',  path: `/p/${personId}/done` },
        ].map(tab => {
          const active = tab.path.endsWith('/done') ? isDone : !isDone
          return (
            <button key={tab.path} onClick={() => router.push(tab.path)} style={{
              flex: 1, padding: '0.7rem', fontSize: '0.9rem', fontWeight: 600,
              border: 'none', cursor: 'pointer', background: 'none',
              color: active ? '#2563eb' : '#64748b',
              borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
            }}>
              {tab.label}
            </button>
          )
        })}
      </nav>

      <main style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {children}
      </main>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const TABS = [
  { label: 'HOME', href: '/' },
  { label: 'TRAINING', href: '/training' },
  { label: 'MUSIK', href: '/musik' },
  { label: 'KALENDER', href: '/kalender' },
  { label: 'ANALYSE', href: '/analyse' },
  { label: 'FINANZEN', href: '/finanzen' },
  { label: 'TERMINAL', href: '/terminal' },
]

export function TopRail() {
  const pathname = usePathname()
  const [clock, setClock] = useState('')

  useEffect(() => {
    const days = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']
    const update = () => {
      const now = new Date()
      const day = days[now.getDay()]
      const d = String(now.getDate()).padStart(2, '0')
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const y = now.getFullYear()
      const h = String(now.getHours()).padStart(2, '0')
      const min = String(now.getMinutes()).padStart(2, '0')
      setClock(`${day} ${d}.${m}.${y} — ${h}:${min}`)
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid rgba(230, 222, 204, 0.6)',
        background: 'rgba(242, 238, 227, 0.82)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        boxShadow: '0 1px 0 rgba(203, 184, 155, 0.25), 0 4px 20px rgba(90, 70, 45, 0.04)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink-0)' }}>
          Personal OS
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.12em', color: 'var(--accent)' }}>
          V1
        </span>
      </span>

      <nav style={{ display: 'flex', gap: '0.25rem' }}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`nav-link${isActive ? ' active' : ''}`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          color: 'var(--ink-3)',
          minWidth: '14rem',
          textAlign: 'right',
          letterSpacing: '0.04em',
        }}
      >
        {clock}
      </span>
    </header>
  )
}

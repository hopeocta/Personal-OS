'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const TABS = [
  { label: 'HOME', href: '/' },
  { label: 'TRAINING', href: '/training' },
  { label: 'MUSIK', href: '/musik' },
  { label: 'ZAHNMEDIZIN', href: '/zahnmedizin' },
  { label: 'WISSEN', href: '/wissen' },
  { label: 'KALENDER', href: '/kalender' },
  { label: 'ANALYSE', href: '/analyse' },
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
        borderBottom: '1px solid oklch(0.98 0 0 / 0.08)',
        background: 'oklch(0.12 0 0 / 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.85rem',
          color: 'var(--ink-2)',
          letterSpacing: '0.1em',
        }}
      >
        PERSONAL OS // V1
      </span>

      <nav style={{ display: 'flex', gap: '0.25rem' }}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.75rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                color: isActive ? 'var(--ink-0)' : 'var(--ink-2)',
                background: isActive ? 'oklch(0.98 0 0 / 0.08)' : 'transparent',
                letterSpacing: '0.05em',
                textDecoration: 'none',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <span
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.85rem',
          color: 'var(--ink-2)',
          minWidth: '14rem',
          textAlign: 'right',
        }}
      >
        {clock}
      </span>
    </header>
  )
}

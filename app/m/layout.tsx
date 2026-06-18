'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV = [
  { href: '/m', label: 'HEUTE', icon: 'sun' as const },
  { href: '/m/erfassen', label: 'ERFASSEN', icon: 'plus' as const },
  { href: '/m/hermes', label: 'HERMES', icon: 'feather' as const },
]

type IconName = 'sun' | 'plus' | 'feather' | 'asterisk'

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (name === 'sun') {
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
      </svg>
    )
  }
  if (name === 'plus') {
    return (
      <svg {...p}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }
  if (name === 'feather') {
    return (
      <svg {...p}>
        <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
        <path d="M16 8L2 22" />
        <path d="M17.5 15H9" />
      </svg>
    )
  }
  // asterisk (Claude-Sunburst)
  return (
    <svg {...p}>
      <path d="M12 5v14M5.5 8l13 8M18.5 8l-13 8" />
    </svg>
  )
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [clock, setClock] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const h = String(now.getHours()).padStart(2, '0')
      const min = String(now.getMinutes()).padStart(2, '0')
      setClock(`${h}:${min}`)
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      style={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--paper)',
        position: 'relative',
      }}
    >
      {/* Masthead */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--line)',
          background: 'rgba(242, 238, 227, 0.9)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <span style={{ color: 'var(--accent)', display: 'flex' }} aria-label="Hermes">
          <Icon name="feather" size={18} />
        </span>
        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink-0)' }}>
          Personal OS
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-3)' }}>
          <Icon name="asterisk" size={13} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>{clock}</span>
        </span>
      </header>

      {/* Scrollbarer Inhalt — nur dieser Bereich scrollt, Masthead + Nav bleiben fix */}
      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>{children}</main>

      {/* Bottom-Nav */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          borderTop: '1px solid var(--line)',
          background: '#FBF8F0',
          padding: '8px 0 max(11px, env(safe-area-inset-bottom))',
        }}
      >
        {NAV.map((item) => {
          const active = item.href === '/m' ? pathname === '/m' : pathname.startsWith(item.href)
          if (item.icon === 'plus') {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label="Erfassen"
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: '#FBF3EC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -20,
                  border: '3px solid var(--paper)',
                  textDecoration: 'none',
                  boxShadow: active ? '0 0 0 2px var(--accent)' : 'none',
                }}
              >
                <Icon name="plus" size={26} />
              </Link>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                textDecoration: 'none',
                color: active ? 'var(--accent)' : 'var(--ink-3)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                letterSpacing: '0.1em',
              }}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

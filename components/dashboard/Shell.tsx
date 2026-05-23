import { ReactNode } from 'react'

export function Shell({
  left,
  center,
  right,
}: {
  left: ReactNode
  center: ReactNode
  right: ReactNode
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 280px',
        gap: '0.875rem',
        alignItems: 'start',
        padding: '1rem 1.5rem',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>{left}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>{center}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>{right}</div>
    </div>
  )
}

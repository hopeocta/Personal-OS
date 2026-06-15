export function MPagePlaceholder({
  title,
  kicker,
  sections,
  note,
}: {
  title: string
  kicker: string
  sections: string
  note: string
}) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '1.35rem', color: 'var(--ink-0)' }}>
          {title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.66rem',
            letterSpacing: '0.14em',
            color: 'var(--ink-3)',
            marginTop: 3,
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </div>
      </div>

      <div
        style={{
          border: '1px dashed var(--line-strong)',
          borderRadius: 14,
          padding: '24px 18px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          letterSpacing: '0.04em',
          color: 'var(--ink-3)',
          lineHeight: 1.9,
        }}
      >
        <div>{sections}</div>
        <div style={{ marginTop: 10, color: 'var(--ink-2)' }}>{note}</div>
      </div>
    </div>
  )
}

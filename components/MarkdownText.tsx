'use client'

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\(Quelle:[^)]*\)|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('(Quelle:'))
          return (
            <span key={i} style={{ color: 'var(--accent)', fontSize: '0.8em', opacity: 0.85 }}>
              {part}
            </span>
          )
        if (part.startsWith('`') && part.endsWith('`'))
          return (
            <code
              key={i}
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.85em',
                background: 'oklch(0.98 0 0 / 0.08)',
                padding: '0.1em 0.3em',
                borderRadius: '3px',
              }}
            >
              {part.slice(1, -1)}
            </code>
          )
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function MarkdownText({ text, style }: { text: string; style?: React.CSSProperties }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ')) {
      elements.push(
        <p
          key={i}
          style={{
            fontWeight: 600,
            fontSize: '0.9rem',
            marginTop: '0.75rem',
            marginBottom: '0.25rem',
            color: 'var(--ink-1)',
          }}
        >
          <InlineText text={line.slice(4)} />
        </p>,
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <p
          key={i}
          style={{
            fontWeight: 700,
            fontSize: '0.95rem',
            marginTop: '1rem',
            marginBottom: '0.3rem',
            color: 'var(--ink-0)',
          }}
        >
          <InlineText text={line.slice(3)} />
        </p>,
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <p
          key={i}
          style={{
            fontWeight: 700,
            fontSize: '1rem',
            marginTop: '1rem',
            marginBottom: '0.3rem',
            color: 'var(--ink-0)',
          }}
        >
          <InlineText text={line.slice(2)} />
        </p>,
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '0.05rem' }}>·</span>
          <span>
            <InlineText text={line.slice(2)} />
          </span>
        </div>,
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '0.5rem' }} />)
    } else {
      elements.push(
        <p key={i} style={{ marginBottom: '0.2rem' }}>
          <InlineText text={line} />
        </p>,
      )
    }
    i++
  }
  return (
    <div style={{ fontSize: '0.875rem', lineHeight: '1.65', color: 'var(--ink-1)', ...style }}>
      {elements}
    </div>
  )
}

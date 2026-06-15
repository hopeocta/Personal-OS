export function MCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      <div className="panel-label" style={{ marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

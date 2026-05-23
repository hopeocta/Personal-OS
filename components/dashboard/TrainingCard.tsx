import { Panel } from './Panel'

type DayStatus = 'done' | 'partial' | 'rest' | 'today' | 'future'

type WeekDay = {
  short: string
  isToday: boolean
  status: DayStatus
}

type PlanItem = {
  title: string
  detail?: string
  status: 'done' | 'pending' | 'later'
}

type WeeklySummary = {
  swimKm: number
  bikeKm: number
  runKm: number
  totalHours: number
}

type Props = {
  week: WeekDay[]
  plan: PlanItem[]
  summary: WeeklySummary
}

const DOT_COLORS: Record<DayStatus, string> = {
  done: 'var(--ok)',
  partial: 'var(--warn)',
  rest: 'oklch(0.98 0 0 / 0.15)',
  today: 'var(--warn)',
  future: 'oklch(0.98 0 0 / 0.07)',
}

const BADGES: Record<PlanItem['status'], { label: string; bg: string; color: string }> = {
  done: { label: 'DONE ✓', bg: 'oklch(0.72 0.18 145 / 0.2)', color: 'var(--ok)' },
  pending: { label: 'AUSSTEHEND', bg: 'oklch(0.75 0.18 80 / 0.2)', color: 'var(--warn)' },
  later: { label: 'MORGEN', bg: 'oklch(0.98 0 0 / 0.07)', color: 'var(--ink-3)' },
}

function fmtHours(h: number): string {
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function TrainingCard({ week, plan, summary }: Props) {
  return (
    <Panel>
      <div className="panel-label">TRAINING</div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.375rem',
          marginBottom: '1rem',
        }}
      >
        {week.map((day) => (
          <div
            key={day.short}
            style={{
              textAlign: 'center',
              padding: '0.375rem 0.25rem',
              borderRadius: '6px',
              background: day.isToday ? 'oklch(0.98 0 0 / 0.1)' : 'oklch(0.98 0 0 / 0.04)',
              border: day.isToday
                ? '1px solid oklch(0.98 0 0 / 0.15)'
                : '1px solid transparent',
            }}
          >
            <div
              style={{
                fontSize: '0.6rem',
                color: day.isToday ? 'var(--accent)' : 'var(--ink-3)',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {day.short}
            </div>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: DOT_COLORS[day.status],
                margin: '0.3rem auto 0',
              }}
            />
          </div>
        ))}
      </div>

      {plan.map((item, i) => {
        const badge = BADGES[item.status]
        return (
          <div
            key={i}
            style={{
              padding: '0.5rem 0',
              borderBottom:
                i < plan.length - 1 ? '1px solid oklch(0.98 0 0 / 0.04)' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: item.status === 'later' ? 'var(--ink-3)' : 'var(--ink-1)',
                }}
              >
                {item.title}
              </div>
              {item.detail && (
                <div style={{ fontSize: '0.65rem', color: 'var(--ink-3)', marginTop: '0.2rem' }}>
                  {item.detail}
                </div>
              )}
            </div>
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.6rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                background: badge.bg,
                color: badge.color,
              }}
            >
              {badge.label}
            </span>
          </div>
        )
      })}

      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid oklch(0.98 0 0 / 0.06)',
        }}
      >
        {[
          { val: `${summary.swimKm}km`, label: 'SWIM' },
          { val: `${summary.bikeKm}km`, label: 'BIKE' },
          { val: `${summary.runKm}km`, label: 'RUN' },
          { val: fmtHours(summary.totalHours), label: 'GESAMT' },
        ].map(({ val, label }) => (
          <div key={label}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.1rem', color: 'var(--ink-0)' }}>
              {val}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--ink-3)' }}>{label}</div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

import { Panel } from './Panel'

type Props = {
  calories: number
  targetCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  notes?: string
}

function Bar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  return (
    <div
      style={{
        height: '4px',
        background: 'oklch(0.98 0 0 / 0.1)',
        borderRadius: '2px',
        overflow: 'hidden',
        marginTop: '0.25rem',
      }}
    >
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
    </div>
  )
}

export function NutritionCard({
  calories,
  targetCalories,
  proteinG,
  carbsG,
  fatG,
  targetProtein,
  targetCarbs,
  targetFat,
  notes,
}: Props) {
  const macros = [
    { name: 'Protein', val: proteinG, target: targetProtein, unit: 'g', color: 'var(--ok)' },
    { name: 'Kohlenhydrate', val: carbsG, target: targetCarbs, unit: 'g', color: 'var(--warn)' },
    { name: 'Fett', val: fatG, target: targetFat, unit: 'g', color: 'var(--accent)' },
  ]

  return (
    <Panel>
      <div className="panel-label">ERNÄHRUNG</div>

      <div style={{ marginBottom: '1rem' }}>
        <div>
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '2.25rem',
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {calories}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--ink-3)', marginLeft: '0.25rem' }}>
            / {targetCalories} kcal
          </span>
        </div>
        <div
          style={{
            height: '6px',
            background: 'oklch(0.98 0 0 / 0.1)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginTop: '0.375rem',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, Math.round((calories / targetCalories) * 100))}%`,
              background: 'var(--accent)',
              borderRadius: '3px',
            }}
          />
        </div>
      </div>

      {macros.map(({ name, val, target, unit, color }) => (
        <div key={name} style={{ marginBottom: '0.625rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-2)' }}>{name}</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-1)' }}>
              {val} / {target}
              {unit}
            </span>
          </div>
          <Bar value={val} target={target} color={color} />
        </div>
      ))}

      {notes && (
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.7rem',
            color: 'var(--ink-3)',
            borderTop: '1px solid oklch(0.98 0 0 / 0.05)',
            paddingTop: '0.5rem',
          }}
        >
          {notes}
        </div>
      )}
    </Panel>
  )
}

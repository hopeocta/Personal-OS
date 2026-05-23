'use client'

import { useState } from 'react'
import { Panel } from './Panel'

type HabitEntry = { name: string; completed: boolean }
type Props = { habits: HabitEntry[]; date: string }

export function HabitsCard({ habits: initial, date }: Props) {
  const [habits, setHabits] = useState(initial)

  const toggle = (i: number) =>
    setHabits((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, completed: !h.completed } : h))
    )

  const done = habits.filter((h) => h.completed).length

  return (
    <Panel>
      <div className="panel-label">HABITS — {date}</div>

      {habits.map((habit, i) => (
        <div
          key={habit.name}
          onClick={() => toggle(i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.4rem 0',
            borderBottom: i < habits.length - 1 ? '1px solid oklch(0.98 0 0 / 0.04)' : 'none',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              border: `1px solid ${habit.completed ? 'var(--ok)' : 'oklch(0.98 0 0 / 0.2)'}`,
              background: habit.completed ? 'var(--ok)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {habit.completed && (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <polyline
                  points="2,5 4,7 8,3"
                  stroke="white"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              color: habit.completed ? 'var(--ink-1)' : 'var(--ink-3)',
            }}
          >
            {habit.name}
          </span>
        </div>
      ))}

      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
        <span
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: 'var(--ok)',
          }}
        >
          {done}/{habits.length}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-3)' }}>
          {Math.round((done / habits.length) * 100)}% heute
        </span>
      </div>
    </Panel>
  )
}

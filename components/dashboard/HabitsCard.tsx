'use client'

import { useState, useEffect } from 'react'
import { Panel } from './Panel'
import { DEFAULT_HABITS } from '@/lib/config/habits'

type HabitEntry = { name: string; completed: boolean }
type Props = { date: string }

export function HabitsCard({ date }: Props) {
  const [habits, setHabits] = useState<HabitEntry[]>(
    DEFAULT_HABITS.map((name) => ({ name, completed: false }))
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/habits?date=${date}`)
      .then((r) => r.json())
      .then((rows: Array<{ habit_name: string; completed: boolean }>) => {
        if (!Array.isArray(rows)) return
        setHabits(
          DEFAULT_HABITS.map((name) => ({
            name,
            completed: rows.find((r) => r.habit_name === name)?.completed ?? false,
          }))
        )
      })
      .catch((e) => console.error('[habits] fetch error:', e))
      .finally(() => setLoading(false))
  }, [date])

  const toggle = async (i: number) => {
    const habit = habits[i]
    const newCompleted = !habit.completed

    setHabits((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, completed: newCompleted } : h))
    )

    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, habit_name: habit.name, completed: newCompleted }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (e) {
      console.error('[habits] toggle error:', e)
      setHabits((prev) =>
        prev.map((h, idx) => (idx === i ? { ...h, completed: !newCompleted } : h))
      )
    }
  }

  const done = habits.filter((h) => h.completed).length

  return (
    <Panel>
      <div className="panel-label">HABITS — {date}</div>

      {habits.map((habit, i) => (
        <div
          key={habit.name}
          onClick={() => !loading && toggle(i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.4rem 0',
            borderBottom:
              i < habits.length - 1 ? '1px solid oklch(0.98 0 0 / 0.04)' : 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
            transition: 'opacity 0.15s',
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
              transition: 'background 0.15s, border-color 0.15s',
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
              transition: 'color 0.15s',
            }}
          >
            {habit.name}
          </span>
        </div>
      ))}

      <div
        style={{
          marginTop: '0.75rem',
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.375rem',
        }}
      >
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

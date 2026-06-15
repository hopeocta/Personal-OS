'use client'

import { useEffect, useState } from 'react'
import { MCard } from './MCard'
import type { RecurringTaskStatus } from '@/lib/types'

export function MTasks() {
  const [tasks, setTasks] = useState<RecurringTaskStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tasks')
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text())
        return r.json()
      })
      .then((rows: RecurringTaskStatus[]) => {
        if (Array.isArray(rows)) setTasks(rows)
      })
      .catch((e) => {
        console.error('[m/tasks] fetch error:', e)
        setError('Aufgaben konnten nicht geladen werden')
      })
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const done = task.due // fällig → erledigen; nicht fällig → rückgängig

    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              due: !done,
              days_until: done ? t.interval_days : 0,
              last_done: done ? new Date().toISOString().slice(0, 10) : null,
            }
          : t,
      ),
    )

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, done }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (e) {
      console.error('[m/tasks] toggle error:', e)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, due: done, days_until: done ? 0 : t.interval_days, last_done: task.last_done }
            : t,
        ),
      )
    }
  }

  const sorted = [...tasks].sort((a, b) => Number(b.due) - Number(a.due) || a.days_until - b.days_until)
  const open = tasks.filter((t) => t.due).length

  return (
    <MCard label="Heute dran">
      {error && <div style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>{error}</div>}
      {!error && !loading && tasks.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Keine Aufgaben angelegt</div>
      )}

      {sorted.map((task, i) => (
        <div
          key={task.id}
          onClick={() => !loading && toggle(task.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 0',
            borderBottom: i < sorted.length - 1 ? '1px solid var(--line)' : 'none',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              border: `1px solid ${task.due ? 'var(--line-strong)' : 'var(--ok)'}`,
              background: task.due ? 'transparent' : 'var(--ok)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {!task.due && (
              <svg width="12" height="12" viewBox="0 0 12 12">
                <polyline
                  points="2.5,6 5,8.5 9.5,3.5"
                  stroke="white"
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <span
            style={{
              fontSize: '0.85rem',
              color: task.due ? 'var(--ink-1)' : 'var(--ink-3)',
              flex: 1,
              textDecoration: task.due ? 'none' : 'line-through',
            }}
          >
            {task.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--ink-3)' }}>
            {task.due ? 'heute' : `in ${task.days_until}d`}
          </span>
        </div>
      ))}

      {!loading && tasks.length > 0 && (
        <div
          style={{
            marginTop: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.66rem',
            letterSpacing: '0.1em',
            color: open > 0 ? 'var(--ink-2)' : 'var(--ok)',
          }}
        >
          {open === 0 ? 'ALLES ERLEDIGT' : `${open} OFFEN`}
        </div>
      )}
    </MCard>
  )
}

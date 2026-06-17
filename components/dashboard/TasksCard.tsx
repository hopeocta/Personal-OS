'use client'

import { useState, useEffect } from 'react'
import { Panel } from './Panel'
import type { RecurringTaskStatus } from '@/lib/types'

export function TasksCard() {
  const [tasks, setTasks] = useState<RecurringTaskStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/tasks')
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text())
        return r.json()
      })
      .then((rows: RecurringTaskStatus[]) => {
        if (Array.isArray(rows)) setTasks(rows)
      })
      .catch((e) => {
        console.error('[tasks] fetch error:', e)
        setError('Aufgaben konnten nicht geladen werden')
      })
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const done = task.due // fällig → erledigen; nicht fällig → rückgängig

    // Optimistisch
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
      console.error('[tasks] toggle error:', e)
      // Rollback
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, due: done, days_until: done ? 0 : t.interval_days, last_done: task.last_done }
            : t,
        ),
      )
    }
  }

  const openCount = tasks.filter((t) => t.due).length

  return (
    <Panel>
      <div className="panel-label">AUFGABEN</div>

      {error && <div style={{ fontSize: '0.72rem', color: 'var(--bad, #e66)' }}>{error}</div>}

      {!error && !loading && tasks.length === 0 && (
        <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>Keine Aufgaben angelegt</div>
      )}

      {tasks.map((task, i) => (
        <div
          key={task.id}
          onClick={() => !loading && toggle(task.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.4rem 0',
            borderBottom: i < tasks.length - 1 ? '1px solid var(--line)' : 'none',
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
              border: `1px solid ${task.due ? 'var(--line-strong)' : 'var(--ok)'}`,
              background: task.due ? 'transparent' : 'var(--ok)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {!task.due && (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <polyline points="2,5 4,7 8,3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              color: task.due ? 'var(--ink-1)' : 'var(--ink-3)',
              flex: 1,
            }}
          >
            {task.name}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--ink-3)' }}>
            {task.due ? 'heute' : `in ${task.days_until}d`}
          </span>
        </div>
      ))}

      <div style={{ marginTop: '0.875rem', paddingTop: '0.625rem', borderTop: '1px solid var(--line)' }}>
        <div
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '2.25rem',
            fontWeight: 700,
            lineHeight: 1,
            color: openCount > 0 ? 'var(--ink-1)' : 'var(--ok)',
          }}
        >
          {openCount}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)', marginTop: '0.2rem' }}>
          {openCount === 0 ? 'alles erledigt' : openCount === 1 ? 'Aufgabe offen' : 'Aufgaben offen'}
        </div>
      </div>
    </Panel>
  )
}

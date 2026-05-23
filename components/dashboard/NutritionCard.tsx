'use client'

import { useState, useEffect, useRef } from 'react'
import { Panel } from './Panel'

const TARGETS = { calories: 2500, protein: 160, carbs: 280, fat: 80 }

type NutritionData = {
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  notes: string | null
}

type Props = { date: string }

function EditableNumber({
  value,
  onSave,
  size = 'normal',
}: {
  value: number | null
  onSave: (v: number | null) => void
  size?: 'large' | 'normal'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value?.toString() ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value?.toString() ?? '')
  }, [value])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    const trimmed = draft.trim()
    const n = trimmed === '' ? null : Number(trimmed)
    onSave(n !== null && !isNaN(n) ? n : value)
    setEditing(false)
  }

  const fontSize = size === 'large' ? '2.25rem' : '0.7rem'
  const fontWeight = size === 'large' ? 600 : 400

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setEditing(false); setDraft(value?.toString() ?? '') }
        }}
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize,
          fontWeight,
          lineHeight: size === 'large' ? 1 : 'inherit',
          background: 'oklch(0.98 0 0 / 0.06)',
          border: '1px solid var(--accent)',
          borderRadius: '3px',
          color: 'var(--ink-1)',
          width: size === 'large' ? '5rem' : '3.5rem',
          padding: '0 0.25rem',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <span
      onClick={() => { setDraft(value?.toString() ?? ''); setEditing(true) }}
      title="Klicken zum Bearbeiten"
      style={{
        cursor: 'text',
        fontFamily: 'ui-monospace, monospace',
        fontSize,
        fontWeight,
        lineHeight: size === 'large' ? 1 : 'inherit',
        borderBottom: '1px dashed oklch(0.98 0 0 / 0.25)',
      }}
    >
      {value ?? '—'}
    </span>
  )
}

function Bar({ value, target, color }: { value: number | null; target: number; color: string }) {
  const pct = value != null ? Math.min(100, Math.round((value / target) * 100)) : 0
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

export function NutritionCard({ date }: Props) {
  const [data, setData] = useState<NutritionData>({
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    notes: null,
  })
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingData = useRef<NutritionData | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/nutrition?date=${date}`)
      .then((r) => r.json())
      .then((row: NutritionData | null) => {
        if (row && typeof row === 'object' && !('error' in row)) setData(row)
      })
      .catch((e) => console.error('[nutrition] fetch error:', e))
      .finally(() => setLoading(false))
  }, [date])

  const save = (patch: Partial<NutritionData>) => {
    const next = { ...data, ...patch }
    setData(next)
    pendingData.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const toSave = pendingData.current
      if (!toSave) return
      fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...toSave }),
      }).catch((e) => console.error('[nutrition] save error:', e))
    }, 600)
  }

  const calPct =
    data.calories != null
      ? Math.min(100, Math.round((data.calories / TARGETS.calories) * 100))
      : 0

  const macros = [
    { name: 'Protein', key: 'protein_g' as const, val: data.protein_g, target: TARGETS.protein, color: 'var(--ok)' },
    { name: 'Kohlenhydrate', key: 'carbs_g' as const, val: data.carbs_g, target: TARGETS.carbs, color: 'var(--warn)' },
    { name: 'Fett', key: 'fat_g' as const, val: data.fat_g, target: TARGETS.fat, color: 'var(--accent)' },
  ]

  return (
    <Panel>
      <div className="panel-label">ERNÄHRUNG{loading ? ' — Lädt...' : ''}</div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
          <EditableNumber value={data.calories} onSave={(v) => save({ calories: v })} size="large" />
          <span style={{ fontSize: '0.7rem', color: 'var(--ink-3)' }}>
            / {TARGETS.calories} kcal
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
              width: `${calPct}%`,
              background: 'var(--accent)',
              borderRadius: '3px',
            }}
          />
        </div>
      </div>

      {macros.map(({ name, key, val, target, color }) => (
        <div key={name} style={{ marginBottom: '0.625rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-2)' }}>{name}</span>
            <span style={{ color: 'var(--ink-1)' }}>
              <EditableNumber value={val} onSave={(v) => save({ [key]: v })} />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-2)' }}>
                {' '}/ {target}g
              </span>
            </span>
          </div>
          <Bar value={val} target={target} color={color} />
        </div>
      ))}

      <div
        style={{
          marginTop: '0.5rem',
          borderTop: '1px solid oklch(0.98 0 0 / 0.05)',
          paddingTop: '0.5rem',
        }}
      >
        <textarea
          placeholder="Notizen..."
          value={data.notes ?? ''}
          onChange={(e) => save({ notes: e.target.value })}
          rows={2}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-3)',
            fontSize: '0.7rem',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>
    </Panel>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { TopRail } from '@/components/dashboard/TopRail'

type ExpenseSummaryRow = {
  category: string
  total_eur: number
  transaction_count: number
}

type Transaction = {
  date: string
  description: string
  amount_eur: number
  category: string | null
  currency: string
}

type SummaryData = {
  summaries: (ExpenseSummaryRow & { month: string })[]
  monthTotals: Record<string, number>
  categoryTotals: Record<string, number>
  recentTransactions: Transaction[]
}

const CATEGORY_COLORS: Record<string, string> = {
  'Lebensmittel': '#4ade80',
  'Restaurants & Cafés': '#fb923c',
  'Transport': '#60a5fa',
  'Gesundheit & Sport': '#a78bfa',
  'Studium & Bücher': '#34d399',
  'Musik & Technik': '#f472b6',
  'Wohnen & Nebenkosten': '#fbbf24',
  'Shopping & Freizeit': '#f87171',
  'Reisen': '#38bdf8',
  'Transfers & Sonstiges': '#94a3b8',
}

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? '#64748b'
}

function MonthBar({ month, total, max }: { month: string; total: number; max: number }) {
  const pct = max > 0 ? (total / max) * 100 : 0
  const label = month.slice(5) + '/' + month.slice(2, 4)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-2)', width: '3rem', textAlign: 'right', flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1.4rem', background: 'oklch(0.98 0 0 / 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'oklch(0.65 0.15 250)',
            borderRadius: '4px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-1)', width: '3.5rem', textAlign: 'right', flexShrink: 0 }}>
        {total.toFixed(0)} €
      </span>
    </div>
  )
}

function CategoryRow({ category, total, max }: { category: string; total: number; max: number }) {
  const pct = max > 0 ? (total / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: categoryColor(category), flexShrink: 0 }} />
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-1)', width: '11rem', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {category}
      </span>
      <div style={{ flex: 1, height: '0.6rem', background: 'oklch(0.98 0 0 / 0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: categoryColor(category), borderRadius: '2px' }} />
      </div>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-2)', width: '3.5rem', textAlign: 'right', flexShrink: 0 }}>
        {total.toFixed(0)} €
      </span>
    </div>
  )
}

export default function FinanzenPage() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [months, setMonths] = useState(6)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/finanzen/summary?months=${months}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: SummaryData) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [months])

  const monthTotals = data?.monthTotals ?? {}
  const categoryTotals = data?.categoryTotals ?? {}
  const maxMonth = Math.max(...Object.values(monthTotals), 1)
  const maxCat = Math.max(...Object.values(categoryTotals), 1)
  const sortedMonths = Object.keys(monthTotals).sort()
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
  const totalAll = Object.values(categoryTotals).reduce((s, v) => s + v, 0)
  const avgMonthly = sortedMonths.length > 0 ? totalAll / sortedMonths.length : 0

  const cardStyle: React.CSSProperties = {
    background: 'oklch(0.14 0 0 / 0.8)',
    border: '1px solid oklch(0.98 0 0 / 0.08)',
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
  }

  const headingStyle: React.CSSProperties = {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.7rem',
    letterSpacing: '0.1em',
    color: 'var(--ink-2)',
    marginBottom: '1rem',
  }

  return (
    <>
      <TopRail />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1.5rem 3rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1rem', color: 'var(--ink-0)', letterSpacing: '0.05em' }}>
            FINANZEN
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.7rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid oklch(0.98 0 0 / 0.1)',
                  background: months === m ? 'oklch(0.98 0 0 / 0.1)' : 'transparent',
                  color: months === m ? 'var(--ink-0)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                {m}M
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-2)' }}>
            Lade …
          </p>
        )}
        {error && (
          <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: '#f87171' }}>
            Fehler: {error}
          </p>
        )}

        {!loading && !error && data && (
          <>
            {/* Keine Daten */}
            {sortedMonths.length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem' }}>
                <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-2)', marginBottom: '0.5rem' }}>
                  Noch keine Transaktionen importiert.
                </p>
                <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                  Revolut CSV exportieren → <code>python analysis/revolut/sync.py export.csv</code>
                </p>
              </div>
            )}

            {sortedMonths.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

                {/* KPIs */}
                <div style={{ ...cardStyle, display: 'flex', gap: '2rem', alignItems: 'center', gridColumn: '1 / -1' }}>
                  <div>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>GESAMT ({months}M)</div>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.4rem', color: 'var(--ink-0)' }}>{totalAll.toFixed(0)} €</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>Ø / MONAT</div>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.4rem', color: 'var(--ink-0)' }}>{avgMonthly.toFixed(0)} €</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>LETZTER MONAT</div>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.4rem', color: 'var(--ink-0)' }}>
                      {monthTotals[sortedMonths[sortedMonths.length - 1]]?.toFixed(0) ?? '—'} €
                    </div>
                  </div>
                </div>

                {/* Monatliche Balken */}
                <div style={cardStyle}>
                  <div style={headingStyle}>AUSGABEN PRO MONAT</div>
                  {sortedMonths.map((m) => (
                    <MonthBar key={m} month={m} total={monthTotals[m] ?? 0} max={maxMonth} />
                  ))}
                </div>

                {/* Kategorien */}
                <div style={cardStyle}>
                  <div style={headingStyle}>NACH KATEGORIE ({months}M gesamt)</div>
                  {sortedCategories.map(([cat, total]) => (
                    <CategoryRow key={cat} category={cat} total={total} max={maxCat} />
                  ))}
                </div>
              </div>
            )}

            {/* Letzte Transaktionen */}
            {data.recentTransactions.length > 0 && (
              <div style={cardStyle}>
                <div style={headingStyle}>LETZTE TRANSAKTIONEN</div>
                <div style={{ display: 'grid', gridTemplateColumns: '5rem 1fr 7rem 5rem', gap: '0 1rem' }}>
                  {['DATUM', 'BESCHREIBUNG', 'KATEGORIE', 'BETRAG'].map((h) => (
                    <div key={h} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--ink-3)', letterSpacing: '0.08em', paddingBottom: '0.5rem', borderBottom: '1px solid oklch(0.98 0 0 / 0.06)' }}>
                      {h}
                    </div>
                  ))}
                  {data.recentTransactions.map((tx, i) => (
                    <>
                      <div key={`d-${i}`} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-2)', padding: '0.35rem 0', borderBottom: '1px solid oklch(0.98 0 0 / 0.04)' }}>
                        {tx.date}
                      </div>
                      <div key={`desc-${i}`} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-1)', padding: '0.35rem 0', borderBottom: '1px solid oklch(0.98 0 0 / 0.04)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description}
                      </div>
                      <div key={`cat-${i}`} style={{ padding: '0.35rem 0', borderBottom: '1px solid oklch(0.98 0 0 / 0.04)' }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', color: categoryColor(tx.category ?? ''), background: `${categoryColor(tx.category ?? '')}22`, padding: '0.15rem 0.4rem', borderRadius: '3px' }}>
                          {tx.category ?? '—'}
                        </span>
                      </div>
                      <div key={`amt-${i}`} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: tx.amount_eur < 0 ? '#f87171' : '#4ade80', padding: '0.35rem 0', borderBottom: '1px solid oklch(0.98 0 0 / 0.04)', textAlign: 'right' }}>
                        {tx.amount_eur.toFixed(2)} €
                      </div>
                    </>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { TopRail } from '@/components/dashboard/TopRail'

type Transaction = {
  date: string
  description: string
  amount_eur: number
  category: string | null
  currency: string
}

type RecurringItem = {
  label: string
  category: string
  monthlyAvg: number
  months: number
}

type SummaryData = {
  months: number
  monthsInData: number
  monthTotals: Record<string, number>
  baselineByMonth: Record<string, number>
  einmaligByMonth: Record<string, number>
  categoryTotals: Record<string, number>
  baselineMonthlyAvg: number
  einmaligAllTimeAvg: number
  foodGroceriesTotal: number
  foodGroceriesMonthlyAvg: number
  recurring: RecurringItem[]
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

const BASELINE_COLOR = 'oklch(0.7 0.13 160)' // grün-blau: Grundlast
const EINMALIG_COLOR = 'oklch(0.68 0.12 30)' // warm: einmalig

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? '#64748b'
}

function StackedMonthBar({
  month,
  baseline,
  einmalig,
  max,
}: {
  month: string
  baseline: number
  einmalig: number
  max: number
}) {
  const total = baseline + einmalig
  const basePct = max > 0 ? (baseline / max) * 100 : 0
  const einPct = max > 0 ? (einmalig / max) * 100 : 0
  const label = month.slice(5) + '/' + month.slice(2, 4)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-2)', width: '3rem', textAlign: 'right', flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1.4rem', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${basePct}%`, height: '100%', background: BASELINE_COLOR, transition: 'width 0.4s ease' }} />
        <div style={{ width: `${einPct}%`, height: '100%', background: EINMALIG_COLOR, transition: 'width 0.4s ease' }} />
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
      <div style={{ flex: 1, height: '0.6rem', background: 'var(--line)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: categoryColor(category), borderRadius: '2px' }} />
      </div>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-2)', width: '3.5rem', textAlign: 'right', flexShrink: 0 }}>
        {total.toFixed(0)} €
      </span>
    </div>
  )
}

function Kpi({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.4rem', color: color ?? 'var(--ink-0)' }}>{value}</div>
      {hint && (
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--ink-3)', marginTop: '0.15rem' }}>{hint}</div>
      )}
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

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--line)',
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
                  border: '1px solid var(--line)',
                  background: months === m ? 'var(--line)' : 'transparent',
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
                  Sync läuft lokal: <code>py -3.14 analysis/revolut/auto_sync.py</code>
                </p>
              </div>
            )}

            {sortedMonths.length > 0 && (
              <>
                {/* KPIs: Grundlast vs. Einmalig */}
                <div style={{ ...cardStyle, display: 'flex', gap: '2.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <Kpi
                    label="GRUNDLAST Ø/MONAT"
                    value={`${data.baselineMonthlyAvg.toFixed(0)} €`}
                    hint="Fixkosten + Einkäufe + Essen"
                    color={BASELINE_COLOR}
                  />
                  <Kpi
                    label="EINMALIG Ø/MONAT"
                    value={`${data.einmaligAllTimeAvg.toFixed(0)} €`}
                    hint={`All-Time-Schnitt (${data.monthsInData} Mon.)`}
                    color={EINMALIG_COLOR}
                  />
                  <Kpi
                    label={`GESAMT (${months}M)`}
                    value={`${totalAll.toFixed(0)} €`}
                  />
                  <Kpi
                    label="LETZTER MONAT"
                    value={`${monthTotals[sortedMonths[sortedMonths.length - 1]]?.toFixed(0) ?? '—'} €`}
                  />
                </div>

                {/* Kombinierter Slot: Einkäufe & Essen */}
                <div style={{ ...cardStyle, display: 'flex', gap: '2.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem', borderColor: 'var(--line-strong)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: categoryColor('Lebensmittel') }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: categoryColor('Restaurants & Cafés') }} />
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-1)', letterSpacing: '0.05em' }}>
                      EINKÄUFE & ESSEN
                    </span>
                  </div>
                  <Kpi label={`KOMBINIERT (${months}M)`} value={`${data.foodGroceriesTotal.toFixed(0)} €`} />
                  <Kpi label="Ø / MONAT" value={`${data.foodGroceriesMonthlyAvg.toFixed(0)} €`} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  {/* Monatliche Balken (gestapelt: Grundlast/Einmalig) */}
                  <div style={cardStyle}>
                    <div style={{ ...headingStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span>AUSGABEN PRO MONAT</span>
                    </div>
                    {/* Legende */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--ink-3)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: BASELINE_COLOR }} /> Grundlast
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--ink-3)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: EINMALIG_COLOR }} /> Einmalig
                      </span>
                    </div>
                    {sortedMonths.map((m) => (
                      <StackedMonthBar
                        key={m}
                        month={m}
                        baseline={data.baselineByMonth[m] ?? 0}
                        einmalig={data.einmaligByMonth[m] ?? 0}
                        max={maxMonth}
                      />
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

                {/* Erkannte Fixkosten */}
                <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                  <div style={headingStyle}>ERKANNTE FIXKOSTEN (wiederkehrend)</div>
                  {data.recurring.length === 0 ? (
                    <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-3)' }}>
                      Noch keine wiederkehrenden Ausgaben erkannt — braucht mehrere Monate mit gleichem Händler.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 8rem 5rem 4rem', gap: '0 1rem' }}>
                      {['HÄNDLER', 'KATEGORIE', 'Ø/MONAT', 'MONATE'].map((h) => (
                        <div key={h} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--ink-3)', letterSpacing: '0.08em', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line)', textAlign: h === 'Ø/MONAT' || h === 'MONATE' ? 'right' : 'left' }}>
                          {h}
                        </div>
                      ))}
                      {data.recurring.map((r, i) => (
                        <div key={i} style={{ display: 'contents' }}>
                          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-1)', padding: '0.35rem 0', borderBottom: '1px solid var(--line)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.label}
                          </div>
                          <div style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--line)' }}>
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', color: categoryColor(r.category), background: `${categoryColor(r.category)}22`, padding: '0.15rem 0.4rem', borderRadius: '3px' }}>
                              {r.category}
                            </span>
                          </div>
                          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-1)', padding: '0.35rem 0', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>
                            {r.monthlyAvg.toFixed(2)} €
                          </div>
                          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-2)', padding: '0.35rem 0', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>
                            {r.months}×
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Letzte Transaktionen */}
                {data.recentTransactions.length > 0 && (
                  <div style={cardStyle}>
                    <div style={headingStyle}>LETZTE TRANSAKTIONEN</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '5rem 1fr 7rem 5rem', gap: '0 1rem' }}>
                      {['DATUM', 'BESCHREIBUNG', 'KATEGORIE', 'BETRAG'].map((h) => (
                        <div key={h} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--ink-3)', letterSpacing: '0.08em', paddingBottom: '0.5rem', borderBottom: '1px solid var(--line)' }}>
                          {h}
                        </div>
                      ))}
                      {data.recentTransactions.map((tx, i) => (
                        <div key={i} style={{ display: 'contents' }}>
                          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-2)', padding: '0.35rem 0', borderBottom: '1px solid var(--line)' }}>
                            {tx.date}
                          </div>
                          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-1)', padding: '0.35rem 0', borderBottom: '1px solid var(--line)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.description}
                          </div>
                          <div style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--line)' }}>
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', color: categoryColor(tx.category ?? ''), background: `${categoryColor(tx.category ?? '')}22`, padding: '0.15rem 0.4rem', borderRadius: '3px' }}>
                              {tx.category ?? '—'}
                            </span>
                          </div>
                          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: tx.amount_eur < 0 ? '#f87171' : '#4ade80', padding: '0.35rem 0', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>
                            {tx.amount_eur.toFixed(2)} €
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

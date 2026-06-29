'use client'
import { useEffect, useState } from 'react'
import { MCard } from './MCard'

type Week = { week: string; activities?: number; total_min?: number; planned: number; done: number; compliance: number | null }
type ProgressData = { dataSource: string; weeks: Week[] }

const BAR_COL = (pct: number | null) =>
  pct === null ? 'var(--color-border-tertiary)' :
  pct >= 80 ? '#639922' : pct >= 60 ? '#BA7517' : '#E24B4A'

const MO = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

function weekLabel(wk: string) {
  const d = new Date(wk + 'T12:00:00')
  return `${d.getDate()}. ${MO[d.getMonth()]}`
}

export function MTrainingTrend() {
  const [data, setData]       = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/p/me/progress?weeks=4')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!data || !data.weeks.length) return null

  const weeks = [...data.weeks].slice(-4)
  const thisWeek = weeks[weeks.length - 1]
  const maxMin = Math.max(...weeks.map(w => w.total_min ?? 0), 60)

  const avgCompliance = data.dataSource === 'garmin' ? null : (() => {
    const pctsWithData = weeks.map(w => w.compliance).filter((v): v is number => v !== null)
    return pctsWithData.length
      ? Math.round(pctsWithData.reduce((a, b) => a + b, 0) / pctsWithData.length)
      : null
  })()

  return (
    <MCard label="Mein Training · Trend">
      {/* Diese Woche: für Garmin → Aktivitäten + Stunden, für TP → done/planned + Compliance */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{
          flex: 1, background: 'var(--color-background-secondary)',
          borderRadius: 'var(--border-radius-md)', padding: '10px 12px',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            DIESE WOCHE
          </div>
          {data.dataSource === 'garmin' ? (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {thisWeek?.activities ?? 0}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: 3 }}>
                Aktivitäten
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 500, color: BAR_COL(thisWeek?.compliance ?? null), lineHeight: 1 }}>
                {thisWeek?.done ?? 0}/{thisWeek?.planned ?? 0}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: 3 }}>
                Einheiten erledigt
              </div>
            </>
          )}
        </div>

        {data.dataSource === 'garmin' && thisWeek?.total_min ? (
          <div style={{
            flex: 1, background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)', padding: '10px 12px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              STUNDEN
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1 }}>
              {Math.round(thisWeek.total_min / 60 * 10) / 10}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: 3 }}>
              diese Woche
            </div>
          </div>
        ) : avgCompliance !== null ? (
          <div style={{
            flex: 1, background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)', padding: '10px 12px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Ø 4 WOCHEN
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 500, color: BAR_COL(avgCompliance), lineHeight: 1 }}>
              {avgCompliance}%
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: 3 }}>
              Compliance
            </div>
          </div>
        ) : null}
      </div>

      {/* 4-Wochen Bars */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 48, marginBottom: 4 }}>
        {weeks.map((w, i) => {
          const metric = data.dataSource === 'garmin' ? (w.total_min ?? 0) : (w.done ?? 0)
          const maxMetric = data.dataSource === 'garmin' ? maxMin : Math.max(...weeks.map(x => x.done ?? 0), 1)
          const h = Math.max(6, Math.round(metric / maxMetric * 48))
          const col = BAR_COL(w.compliance)
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', height: 48, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: h, background: col, borderRadius: 3 }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>
                {weekLabel(w.week)}
              </div>
            </div>
          )
        })}
      </div>

    </MCard>
  )
}

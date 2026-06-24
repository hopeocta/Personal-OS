'use client'
import { useEffect, useState } from 'react'

type Week = { week: string; planned: number; done: number; pct: number | null }
type Athlete = {
  id: string
  name: string
  dataSource: string
  planWeek: number | null
  currentPhase: { name: string; goal: string } | null
  thisWeek: { planned: number; done: number; pct: number | null }
  weeks4: Week[]
  avgCompliance: number | null
  phaseHealth: 'good' | 'ok' | 'behind' | null
  garminActsThisWeek: number | null
  lastCtl: number | null
  lastTss: number | null
}

const HEALTH_COL = { good: '#3B6D11', ok: '#854F0B', behind: '#A32D2D' }
const HEALTH_BG  = { good: '#EAF3DE', ok: '#FAEEDA', behind: '#FCEBEB' }
const HEALTH_LABEL = { good: 'auf Plan', ok: 'fast auf Plan', behind: 'im Rückstand' }
const BAR_COL    = { good: '#639922', ok: '#BA7517', behind: '#E24B4A' }

function compliance(pct: number | null): 'good' | 'ok' | 'behind' {
  if (pct === null) return 'ok'
  return pct >= 80 ? 'good' : pct >= 60 ? 'ok' : 'behind'
}

export function AthletenUbersicht() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/training/athletes-overview')
      .then(r => r.json())
      .then(d => { setAthletes(d.athletes ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading || athletes.length === 0) return null

  return (
    <div className="card" style={{ padding: '1rem 1.25rem' }}>
      <div className="panel-label" style={{ marginBottom: '0.875rem' }}>Athleten · Trainingsüberblick</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {athletes.map(a => {
          const hk = a.phaseHealth ?? 'ok'
          const hc = HEALTH_COL[hk]
          const hb = HEALTH_BG[hk]

          const isSelf = a.id === 'me'
        const cardContent = (
              <div style={{
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 'var(--border-radius-md)',
                padding: '10px 12px',
                transition: 'border-color 0.15s',
              }}>
                {/* Zeile 1: Name + Phase-Badge + Phase-Health */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {a.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {a.dataSource === 'tp' ? 'TrainingPeaks' : 'Garmin'}
                    {a.planWeek ? ` · Woche ${a.planWeek}` : ''}
                  </span>
                  {a.currentPhase && (
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      background: 'var(--color-background-primary)',
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 20, padding: '1px 8px',
                      color: 'var(--color-text-secondary)',
                    }}>
                      {a.currentPhase.name}
                    </span>
                  )}
                  {a.phaseHealth && (
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      background: hb, color: hc,
                      borderRadius: 20, padding: '1px 8px',
                    }}>
                      {HEALTH_LABEL[hk]}
                    </span>
                  )}
                </div>

                {/* Zeile 2: Phasenziel */}
                {a.currentPhase && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>
                    Ziel: {a.currentPhase.goal}
                    {(a.lastCtl || a.lastTss) && (
                      <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }}>
                        {a.lastCtl ? `· CTL ${a.lastCtl}` : ''}
                        {a.lastTss ? `· TSS ${a.lastTss}` : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Zeile 3: Diese Woche + 4-Wochen-Bars */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flexShrink: 0 }}>
                    {isSelf ? (
                      <>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {a.garminActsThisWeek ?? 0}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)', marginLeft: 4 }}>
                          Einheiten
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
                          color: a.thisWeek.pct !== null ? HEALTH_COL[compliance(a.thisWeek.pct)] : 'var(--color-text-secondary)',
                        }}>
                          {a.thisWeek.done}/{a.thisWeek.planned}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)', marginLeft: 4 }}>
                          diese Wo
                        </span>
                      </>
                    )}
                  </div>

                  {/* 4-Wochen Mini-Bars */}
                  <div style={{ flex: 1, display: 'flex', gap: 3, alignItems: 'flex-end', height: 24 }}>
                    {a.weeks4.map((w, i) => {
                      const ck = compliance(w.pct)
                      const pct = w.pct ?? 0
                      const h = Math.max(4, Math.round(pct / 100 * 24))
                      return (
                        <div key={i} style={{
                          flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end',
                          background: 'var(--color-border-tertiary)', borderRadius: 2,
                        }}>
                          <div style={{
                            width: '100%', height: h,
                            background: BAR_COL[ck], borderRadius: 2,
                            transition: 'height 0.3s',
                          }} title={`${pct}% · ${w.done}/${w.planned}`} />
                        </div>
                      )
                    })}
                    {a.weeks4.length === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Noch keine Daten</span>
                    )}
                  </div>

                  {a.avgCompliance !== null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: HEALTH_COL[compliance(a.avgCompliance)], flexShrink: 0 }}>
                      Ø {a.avgCompliance}%
                    </span>
                  )}
                </div>
              </div>
        )

        return isSelf
          ? <div key={a.id}>{cardContent}</div>
          : <a key={a.id} href={`/p/${a.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{cardContent}</a>
      })}
      </div>
    </div>
  )
}

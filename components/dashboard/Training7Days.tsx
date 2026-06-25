'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'
import type { GarminActivity, TrainingPlanSession } from '@/lib/types'

const SPORT_COL: Record<string, string> = {
  running: 'var(--sport-run)', trail_running: 'var(--sport-run)',
  cycling: 'var(--sport-bike)', indoor_cycling: 'var(--sport-bike)',
  road_biking: 'var(--sport-bike)', virtual_ride: 'var(--sport-bike)',
  lap_swimming: 'var(--sport-swim)', open_water_swimming: 'var(--sport-swim)',
  strength_training: 'var(--sport-strength)', functional_strength_training: 'var(--sport-strength)',
  multi_sport: 'var(--accent)',
}
const SPORT_ICON: Record<string, string> = {
  running: '🏃', trail_running: '🏃', cycling: '🚴', indoor_cycling: '🚴',
  road_biking: '🚴', virtual_ride: '🚴', lap_swimming: '🏊',
  open_water_swimming: '🏊', strength_training: '🏋', functional_strength_training: '🏋',
  multi_sport: '⚡',
}
const PLAN_ICON: Record<string, string> = {
  swim: '🏊', bike: '🚴', run: '🏃', strength: '🏋', brick: '⚡', rest: '😴',
}
// Garmin-Typen die zu einem Plan-Sport passen
const SPORT_MATCH: Record<string, string[]> = {
  run: ['running', 'trail_running', 'treadmill_running'],
  bike: ['cycling', 'indoor_cycling', 'road_biking', 'virtual_ride', 'e_bike_fitness'],
  swim: ['lap_swimming', 'open_water_swimming'],
  strength: ['strength_training', 'functional_strength_training'],
  brick: ['multi_sport'],
}

const DAY_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDur(min: number | null | undefined): string {
  if (!min) return ''
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function last7Days(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 6; i >= 0; i--) {
    const x = new Date(d)
    x.setDate(d.getDate() - i)
    out.push(localIso(x))
  }
  return out
}

type Summary = { swimKm: number; bikeKm: number; runKm: number; totalHours: number; activities: GarminActivity[] }

export function Training7Days() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [plan, setPlan] = useState<TrainingPlanSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/training/summary?days=7').then(r => r.ok ? r.json() : null),
      // Plan der letzten 7 Tage: from/to explizit übergeben damit vergangene Tage kommen
      fetch('/api/training/plan?past=7').then(r => r.ok ? r.json() : { sessions: [] }),
    ]).then(([s, p]) => {
      setSummary(s)
      setPlan(p?.sessions ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const days = last7Days()
  const today = localIso(new Date())
  const acts = summary?.activities ?? []

  // Index: Datum → Aktivitäten
  const actsByDate: Record<string, GarminActivity[]> = {}
  for (const a of acts) {
    const d = String(a.date)
    ;(actsByDate[d] ??= []).push(a)
  }

  // Index: Datum → Plan-Sessions (nur nicht-optional, kein rest)
  const planByDate: Record<string, TrainingPlanSession[]> = {}
  for (const s of plan) {
    if (s.sport === 'rest') continue
    ;(planByDate[s.date] ??= []).push(s)
  }

  return (
    <Panel>
      <div className="panel-label">Training · letzte 7 Tage</div>

      {loading && <div style={{ color: 'var(--ink-3)', fontSize: '0.75rem', marginTop: 8 }}>Lädt…</div>}

      {!loading && (
        <>
          {/* Stat-Kacheln */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '10px 0 14px' }}>
            {[
              { label: 'Einheiten', value: String(acts.length), color: 'var(--ink-0)' },
              { label: '🏊 Schwimm', value: `${summary?.swimKm ?? 0} km`, color: 'var(--sport-swim)' },
              { label: '🚴 Rad',     value: `${summary?.bikeKm ?? 0} km`, color: 'var(--sport-bike)' },
              { label: '🏃 Laufen',  value: `${summary?.runKm  ?? 0} km`, color: 'var(--sport-run)'  },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--ink-4)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 500, color, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Tag-für-Tag-Ansicht */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {days.map((day) => {
              const dayActs = actsByDate[day] ?? []
              const dayPlan = planByDate[day] ?? []
              const isToday = day === today
              const d = new Date(day + 'T12:00:00')
              const isEmpty = dayActs.length === 0 && dayPlan.length === 0

              if (isEmpty) return null

              // Für jede Plan-Session: matcht eine Garmin-Aktivität?
              const matched = new Set<string>() // act.id die gematcht wurden

              return (
                <div key={day} style={{
                  borderTop: '1px solid var(--line)',
                  padding: '7px 0',
                }}>
                  {/* Tag-Header */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: dayActs.length > 0 ? 6 : 0 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: isToday ? 'var(--accent)' : 'var(--ink-3)',
                      minWidth: 24,
                    }}>
                      {DAY_FULL[d.getDay()].slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: isToday ? 'var(--accent)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                      {d.getDate()}.{d.getMonth() + 1}.{isToday ? ' · heute' : ''}
                    </span>

                    {/* Plan-Chips rechts */}
                    {dayPlan.length > 0 && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                        {dayPlan.map(s => {
                          const matchingAct = (actsByDate[day] ?? []).find(a =>
                            !matched.has(String(a.id)) && (SPORT_MATCH[s.sport] ?? []).includes(String(a.type))
                          )
                          if (matchingAct) matched.add(String(matchingAct.id))
                          const done = !!matchingAct
                          return (
                            <span key={s.id} title={s.title} style={{
                              fontFamily: 'var(--font-mono)', fontSize: '0.52rem', letterSpacing: '0.05em',
                              textTransform: 'uppercase', padding: '2px 6px', borderRadius: 20,
                              border: `1px solid ${done ? 'var(--sport-' + s.sport + ', var(--ink-3))' : 'var(--line-strong)'}`,
                              background: done ? 'rgba(91,189,114,0.12)' : 'transparent',
                              color: done ? '#3B6D11' : 'var(--ink-3)',
                              opacity: done ? 1 : 0.7,
                            }}>
                              {PLAN_ICON[s.sport] ?? '•'} {done ? '✓' : s.sport}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Aktivitäten */}
                  {dayActs.map(a => {
                    const col = SPORT_COL[String(a.type)] ?? 'var(--ink-3)'
                    const icon = SPORT_ICON[String(a.type)] ?? '•'
                    const dist = a.distance_km != null && Number(a.distance_km) > 0 ? ` · ${a.distance_km} km` : ''
                    const dur = fmtDur(a.duration_min)
                    // Ist diese Aktivität extra (kein passender Planeintrag an diesem Tag)?
                    const isExtra = dayPlan.length > 0 && !(dayPlan.some(s =>
                      (SPORT_MATCH[s.sport] ?? []).includes(String(a.type))
                    ))
                    return (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '3px 0 3px 4px',
                      }}>
                        <span style={{ fontSize: '0.9rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                        <span style={{
                          flex: 1, fontSize: '0.78rem', color: 'var(--ink-1)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {a.name || String(a.type).replace(/_/g, ' ')}
                        </span>
                        {isExtra && (
                          <span style={{ fontSize: '0.55rem', color: col, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>
                            +extra
                          </span>
                        )}
                        <span style={{ fontSize: '0.7rem', color: col, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                          {dur}{dist}
                        </span>
                      </div>
                    )
                  })}

                  {/* Nur geplant, nicht gemacht — heute oder Zukunft ignorieren */}
                  {dayPlan.filter(s => {
                    const wasDone = (actsByDate[day] ?? []).some(a =>
                      (SPORT_MATCH[s.sport] ?? []).includes(String(a.type))
                    )
                    return !wasDone && day < today
                  }).map(s => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '3px 0 3px 4px', opacity: 0.45,
                    }}>
                      <span style={{ fontSize: '0.9rem', lineHeight: 1, flexShrink: 0 }}>{PLAN_ICON[s.sport] ?? '•'}</span>
                      <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--ink-3)', fontStyle: 'italic' }}>
                        {s.title}
                      </span>
                      <span style={{ fontSize: '0.55rem', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        nicht gemacht
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {acts.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              Keine Aktivitäten in den letzten 7 Tagen
            </div>
          )}
        </>
      )}
    </Panel>
  )
}

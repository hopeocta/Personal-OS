'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'
import type { TrainingPlanSession, CalendarEvent } from '@/lib/types'

const DOW = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']

type SportStyle = { spine: string; bg: string; fg: string; icon: string }

// Sport-Farbcodes (Runna-inspiriert). Lauf-Variante hängt am session_type.
function styleFor(s: TrainingPlanSession): SportStyle {
  if (s.sport === 'run') {
    const t = s.session_type ?? ''
    if (t === 'long') return { spine: '#7E5A86', bg: '#EAE0EE', fg: '#46304D', icon: '🏃' }
    if (t === 'tempo') return { spine: '#D49A2F', bg: '#F5E8CC', fg: '#7A5610', icon: '🏃' }
    if (t === 'intervals' || t === 'quality') return { spine: '#C2602F', bg: '#F3E0D2', fg: '#7C3D17', icon: '🏃' }
    if (t === 'timetrial') return { spine: '#B23B3B', bg: '#F3D8D8', fg: '#7A2020', icon: '🏃' }
    return { spine: '#6B8E3D', bg: '#E6EDD6', fg: '#3B5417', icon: '🏃' }
  }
  if (s.sport === 'bike') return { spine: '#3E7C8C', bg: '#DBE9EE', fg: '#1E4350', icon: '🚴' }
  if (s.sport === 'swim') return { spine: '#4FA6A0', bg: '#DCEFEC', fg: '#1F4E4A', icon: '🏊' }
  if (s.sport === 'strength') return { spine: '#C0623B', bg: '#F3E0D5', fg: '#7C3D1F', icon: '🏋' }
  if (s.sport === 'brick') return { spine: '#C0623B', bg: '#F3E0D5', fg: '#7C3D1F', icon: '⚡' }
  return { spine: '#A89B8C', bg: '#EDE6D6', fg: '#7C6F5A', icon: '😴' }
}

function pillText(s: TrainingPlanSession): string {
  if (s.sport === 'rest') return 'Rest'
  if (s.sport === 'swim') return s.session_type === 'easy' ? 'Technik' : 'Schwimmen'
  const parts: string[] = []
  if (s.is_easy) parts.push('Easy')
  if (s.hf_zone) parts.push(s.hf_zone)
  return parts.length ? parts.join(' · ') : (s.session_type ?? 'Einheit')
}

function metricText(s: TrainingPlanSession): string {
  const bits: string[] = []
  if (s.distance_km != null) bits.push(`${s.distance_km} km`)
  if (s.duration_min != null) bits.push(`${s.duration_min} min`)
  return bits.join(' · ')
}

// Garmin-Kalender-Lauf (von Runna gepusht) → Karten-Shape (wie TrainingPlanSession).
const RUN_KW = ['lauf', 'run', 'tempo', 'intervall', 'wiederhol', 'zeitlauf', 'progressiv', 'fahrtspiel']
function isRunEvent(ev: CalendarEvent): boolean {
  if (ev.source === 'training') return false
  return RUN_KW.some((k) => ev.title.toLowerCase().includes(k))
}
// Ganztags-Events kommen als UTC-Mitternacht-1 (z.B. ...T22:00Z) → lokales Datum nehmen.
function localKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function runFromEvent(ev: CalendarEvent): TrainingPlanSession {
  const t = ev.title.toLowerCase()
  let type = 'easy', hf = 'Z2', range = '130–147', pace = 'locker', label = 'Dauerlauf'
  if (t.includes('langer lauf') || t.includes('lang ')) { type = 'long'; label = 'Langer Lauf' }
  else if (t.includes('zeitlauf')) { type = 'timetrial'; hf = 'Z4/Z5'; range = '160–175'; pace = 'Zeitlauf'; label = 'Zeitlauf' }
  else if (t.includes('intervall') || t.includes('wiederhol') || /\d00\s?-?m/.test(t)) { type = 'intervals'; hf = 'Z5'; range = '169–181'; pace = 'Intervalle'; label = 'Intervalle' }
  else if (t.includes('tempo') || t.includes('progressiv')) { type = 'tempo'; hf = 'Z3/Z4'; range = '148–168'; pace = 'Tempo'; label = 'Tempo' }
  const km = ev.title.match(/(\d+(?:[.,]\d+)?)\s*km/)
  return {
    id: ev.id,
    user_id: 'me',
    date: localKey(ev.start),
    sport: 'run',
    session_type: type,
    title: `Runna: ${label}`,
    is_easy: type === 'easy' || type === 'long',
    hf_zone: hf,
    hf_range: range,
    pace_speed: pace,
    watts_indoor: null,
    duration_min: null,
    distance_km: km ? parseFloat(km[1].replace(',', '.')) : null,
    details: `${ev.title} (aus Garmin / Runna)`,
    source: 'garmin',
    sort_order: 0,
    created_at: '',
  }
}

function next7Keys(): string[] {
  const out: string[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    out.push(
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    )
  }
  return out
}

export function TrainingNext7() {
  const [sessions, setSessions] = useState<TrainingPlanSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/training/plan?days=7').then((r) => (r.ok ? r.json() : { sessions: [] })),
      fetch('/api/calendar?days=7').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([plan, cal]: [{ sessions: TrainingPlanSession[] }, CalendarEvent[]]) => {
        const db = plan.sessions ?? []
        const runs = (Array.isArray(cal) ? cal : []).filter(isRunEvent).map(runFromEvent)
        setSessions([...db, ...runs])
      })
      .catch((e) => {
        console.error('[TrainingNext7] error:', e)
        setError('Plan konnte nicht geladen werden.')
      })
      .finally(() => setLoading(false))
  }, [])

  const days = next7Keys()
  const todayKey = days[0]

  function toggleDone(id: string) {
    setDone((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // Reihenfolge je Tag: Lauf/Rad/Schwimm vor Kraft, Rest zuletzt.
  const ORDER: Record<string, number> = { run: 0, bike: 1, swim: 2, brick: 1, strength: 3, rest: 4 }

  return (
    <Panel>
      <div className="panel-label">Nächste 7 Tage</div>

      {loading && <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Lädt…</div>}
      {error && <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {days.map((key) => {
            const dayDate = new Date(key + 'T00:00:00')
            const daySessions = sessions
              .filter((s) => s.date === key)
              .sort((a, b) => (ORDER[a.sport] ?? 9) - (ORDER[b.sport] ?? 9))
            const isToday = key === todayKey

            return (
              <div key={key}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.62rem',
                    letterSpacing: '0.1em',
                    color: isToday ? 'var(--accent)' : 'var(--ink-3)',
                    marginBottom: '0.35rem',
                  }}
                >
                  {DOW[dayDate.getDay()]} {dayDate.getDate()}.{dayDate.getMonth() + 1}.
                  {isToday ? ' · HEUTE' : ''}
                </div>

                {daySessions.length === 0 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)', paddingLeft: '0.25rem' }}>
                    —
                  </div>
                )}

                {daySessions.map((s) => {
                  const st = styleFor(s)
                  const isOpen = openId === s.id
                  const isDone = done.has(s.id)
                  const isRest = s.sport === 'rest'
                  return (
                    <div
                      key={s.id}
                      className="card-hover"
                      onClick={() => setOpenId(isOpen ? null : s.id)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--line)',
                        borderRadius: '11px',
                        overflow: 'hidden',
                        marginBottom: '0.4rem',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.75rem' }}>
                        <div style={{ width: 5, alignSelf: 'stretch', borderRadius: 3, background: st.spine, flex: '0 0 5px' }} />
                        <div
                          style={{
                            width: 30, height: 30, borderRadius: 8, flex: '0 0 30px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.95rem', background: st.bg,
                          }}
                        >
                          {st.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--ink-0)' }}>{s.title}</div>
                          {metricText(s) && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--ink-3)' }}>{metricText(s)}</div>
                          )}
                        </div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.04em',
                            textTransform: 'uppercase', padding: '0.18rem 0.5rem', borderRadius: 20,
                            background: st.bg, color: st.fg, whiteSpace: 'nowrap',
                          }}
                        >
                          {pillText(s)}
                        </span>
                        {!isRest && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleDone(s.id) }}
                            aria-label={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
                            style={{
                              width: 22, height: 22, borderRadius: '50%', flex: '0 0 22px', cursor: 'pointer',
                              border: `1.5px solid ${isDone ? '#6B8E3D' : 'var(--line-strong)'}`,
                              background: isDone ? '#6B8E3D' : 'transparent',
                              color: '#fff', fontSize: '0.7rem', lineHeight: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all .18s ease',
                            }}
                          >
                            {isDone ? '✓' : ''}
                          </button>
                        )}
                      </div>

                      {isOpen && !isRest && (
                        <div
                          style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.6rem',
                            padding: '0.1rem 0.9rem 0.7rem 3.4rem', borderTop: '1px dashed var(--line)',
                          }}
                        >
                          {s.is_easy && <Detail k="Intensität" v="Easy" />}
                          {s.hf_zone && <Detail k="HF-Zone" v={s.hf_zone} />}
                          {s.hf_range && <Detail k="HF-Bereich" v={s.hf_range} />}
                          {s.watts_indoor && <Detail k="Watt (Indoor)" v={s.watts_indoor} accent />}
                          {s.pace_speed && <Detail k="Pace/Tempo" v={s.pace_speed} />}
                          {s.details && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={detKey}>Hinweis</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--ink-2)', marginTop: 2 }}>{s.details}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

const detKey: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--ink-3)',
}

function Detail({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <div style={detKey}>{k}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', color: accent ? 'var(--accent)' : 'var(--ink-0)', marginTop: 2 }}>
        {v}
      </div>
    </div>
  )
}

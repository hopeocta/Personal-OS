'use client'

import { useEffect, useState } from 'react'
import { Panel } from './Panel'
import type { TrainingPlanSession, CalendarEvent } from '@/lib/types'
import { isCalendarRunEvent } from '@/lib/trainingCalendar'

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
    is_optional: false,
    is_event: false,
    outdoor_alt: null,
    intensity_kind: null,
    completed_at: null,
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

type SlotCheckResult = {
  machbar: boolean
  ampel: 'grün' | 'gelb' | 'rot' | 'grau'
  einheit: { sport: string; intensitaet: string; dauer_min: number; zone: string; titel: string; beschreibung: string } | null
  begruendung: string
}
const AMPEL_COL: Record<string, string> = { grün: '#5bbd72', gelb: '#d4a017', rot: '#c0623b', grau: '#aaa' }
const SPORT_EMOJI: Record<string, string> = { swim: '🏊', bike: '🚴', run: '🏃', strength: '🏋' }

export function TrainingNext7() {
  const [sessions, setSessions] = useState<TrainingPlanSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [slotChecks, setSlotChecks] = useState<Record<string, SlotCheckResult | 'loading' | 'error'>>({})

  async function checkSlot(date: string) {
    setSlotChecks((p) => ({ ...p, [date]: 'loading' }))
    try {
      const res = await fetch('/api/training/slot-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data: SlotCheckResult = await res.json()
      setSlotChecks((p) => ({ ...p, [date]: data }))
    } catch (e) {
      console.error('[slot-check] error:', e)
      setSlotChecks((p) => ({ ...p, [date]: 'error' }))
    }
  }

  async function loadData(bust = false) {
    const calUrl = bust ? '/api/calendar?days=7&bust=1' : '/api/calendar?days=7'
    return Promise.all([
      fetch('/api/training/plan?days=7').then((r) => (r.ok ? r.json() : { sessions: [] })),
      fetch(calUrl).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([plan, cal]: [{ sessions: TrainingPlanSession[] }, CalendarEvent[]]) => {
        const db = plan.sessions ?? []
        const runs = (Array.isArray(cal) ? cal : []).filter((ev) => ev.source !== 'training' && isCalendarRunEvent(ev.title)).map(runFromEvent)
        const planRunDates = new Set(db.filter((s) => s.sport === 'run').map((s) => s.date))
        const seenRunDate = new Set<string>()
        const uniqueRuns = runs.filter((r) => {
          if (planRunDates.has(r.date)) return false
          if (seenRunDate.has(r.date)) return false
          seenRunDate.add(r.date)
          return true
        })
        setSessions([...db, ...uniqueRuns])
      })
      .catch((e) => {
        console.error('[TrainingNext7] error:', e)
        setError('Plan konnte nicht geladen werden.')
      })
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await fetch('/api/training/sync-runna', { method: 'POST' })
    } catch (e) {
      console.error('[TrainingNext7] sync-runna error:', e)
    }
    await loadData(true)
    setRefreshing(false)
  }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div className="panel-label" style={{ margin: 0 }}>Nächste 7 Tage</div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Runna-Läufe neu laden (Google Calendar)"
          style={{
            border: '1px solid var(--line)', borderRadius: 6, background: 'transparent',
            cursor: refreshing ? 'default' : 'pointer', padding: '2px 8px',
            fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.06em',
            color: refreshing ? 'var(--ink-3)' : 'var(--accent)', textTransform: 'uppercase',
          }}
        >
          {refreshing ? 'Lädt…' : '↻ Runna'}
        </button>
      </div>

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
                  <DesktopSlotCheck date={key} result={slotChecks[key]} onCheck={() => checkSlot(key)} />
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

// ── Desktop Slot-Check ────────────────────────────────────
function DesktopSlotCheck({ date, result, onCheck }: {
  date: string
  result: SlotCheckResult | 'loading' | 'error' | undefined
  onCheck: () => void
}) {
  if (!result) {
    return (
      <button
        onClick={onCheck}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          border: '1px dashed var(--line-strong)', borderRadius: 8,
          padding: '4px 10px', cursor: 'pointer', background: 'transparent',
          fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.06em',
          color: 'var(--ink-3)', textTransform: 'uppercase',
          transition: 'border-color .15s, color .15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-strong)' }}
      >
        💡 Einheit checken
      </button>
    )
  }
  if (result === 'loading') {
    return <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)', fontStyle: 'italic', paddingLeft: '0.25rem' }}>Analysiere…</div>
  }
  if (result === 'error') {
    return <div style={{ fontSize: '0.7rem', color: 'var(--danger)', paddingLeft: '0.25rem' }}>Fehler — nochmal versuchen</div>
  }

  const col = AMPEL_COL[result.ampel] ?? '#aaa'
  const e = result.einheit
  return (
    <div style={{
      border: `1.5px solid ${col}`, borderRadius: 11,
      background: `${col}10`, overflow: 'hidden', marginBottom: '0.4rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.55rem 0.75rem' }}>
        <div style={{ width: 5, alignSelf: 'stretch', borderRadius: 3, background: col, flex: '0 0 5px' }} />
        <div style={{ width: 30, height: 30, borderRadius: 8, flex: '0 0 30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', background: `${col}25` }}>
          {e ? (SPORT_EMOJI[e.sport] ?? '•') : (result.ampel === 'rot' ? '🛑' : '—')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--ink-0)' }}>
            {e ? e.titel : 'Besser pausieren'}
          </div>
          {e && (
            <div style={{ fontSize: '0.68rem', color: 'var(--ink-3)' }}>
              {e.dauer_min} min · {e.zone} · {e.intensitaet}
            </div>
          )}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.04em',
          textTransform: 'uppercase', padding: '0.18rem 0.5rem', borderRadius: 20,
          background: `${col}25`, color: col, whiteSpace: 'nowrap', fontWeight: 700,
        }}>
          {result.ampel}
        </span>
      </div>
      <div style={{ padding: '0 0.75rem 0.6rem 3.4rem', fontSize: '0.72rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
        {result.begruendung}
        {e?.beschreibung && (
          <div style={{ marginTop: 4, borderLeft: `2px solid ${col}`, paddingLeft: 7, color: 'var(--ink-3)' }}>
            {e.beschreibung}
          </div>
        )}
      </div>
    </div>
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

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MCard } from './MCard'
import type { TrainingPlanSession, CalendarEvent } from '@/lib/types'
import { isCalendarRunEvent } from '@/lib/trainingCalendar'

// Sportfarben aus dem eigenen Theme (NICHT ändern) ──────────
const SPORT_COLOR: Record<string, string> = {
  swim: 'var(--sport-swim)', bike: 'var(--sport-bike)', run: 'var(--sport-run)',
  strength: 'var(--sport-strength)', brick: 'var(--accent)', rest: 'var(--sport-rest)',
}
const SPORT_LABEL: Record<string, string> = {
  swim: 'Schwimmen', bike: 'Rad', run: 'Laufen',
  strength: 'Kraft', brick: 'Brick', rest: 'Ruhe',
}
// Emoji-Icons wie in Utes PWA übernommen
const SPORT_ICON: Record<string, string> = {
  swim: '🏊', bike: '🚴', run: '🏃', strength: '🏋', brick: '⚡', rest: '😴',
}
const DAY_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

const SPORT_TYPE_MAP: Record<string, string[]> = {
  run: ['running', 'trail_running', 'treadmill_running'],
  swim: ['swimming', 'lap_swimming', 'open_water_swimming'],
  bike: ['cycling', 'indoor_cycling', 'virtual_ride'],
  strength: ['strength_training'],
  brick: ['running', 'trail_running', 'cycling', 'indoor_cycling', 'swimming', 'lap_swimming', 'multi_sport'],
  rest: [],
}

// ── Datum-Helfer (lokale Zeit) ──────────────────────────────
function parseDate(s: string) { return new Date(s + 'T12:00:00') }
function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDaysLocal(dateStr: string, n: number) {
  const d = parseDate(dateStr); d.setDate(d.getDate() + n); return localIso(d)
}
function weekStart(dateStr: string) {
  const d = parseDate(dateStr); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localIso(d)
}
function wdFull(d: string) { return DAY_FULL[parseDate(d).getDay()] }
function dayNum(d: string) { return String(parseDate(d).getDate()) }
function monthShort(d: string) { return MONTH_SHORT[parseDate(d).getMonth()] }
function fmtDur(min: number | null): string {
  if (!min) return ''
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}
function clean(v: string | null | undefined): string | null {
  const t = (v ?? '').trim(); return t && t !== '—' ? t : null
}
function localDateFromEvent(e: CalendarEvent): string {
  if (!e.allDay) return e.start.slice(0, 10)
  return new Date(e.start).toLocaleDateString('en-CA')
}
function parseRunnaDistance(title: string): number | null {
  const m = title.match(/\((\d+[,.]\d*|\d+)\s*km\)/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}
function parseRunnaWorkoutType(title: string): string | null {
  const dashIdx = title.lastIndexOf(' - ')
  if (dashIdx < 0) return null
  const after = title.slice(dashIdx + 3)
  const parenIdx = after.lastIndexOf(' (')
  return parenIdx > 0 ? after.slice(0, parenIdx).trim() : after.trim()
}

type DisplaySession = {
  id: string; date: string; sport: string; title: string
  duration_min: number | null; distance_km: number | null; details: string | null
  hf_zone: string | null; hf_range: string | null; pace_speed: string | null
  watts_indoor: string | null; outdoor_alt: string | null
  is_optional: boolean; is_event: boolean; intensity_kind: string | null
  locked: boolean
}

function fromPlan(s: TrainingPlanSession): DisplaySession {
  return {
    id: s.id, date: s.date, sport: s.sport, title: s.title,
    duration_min: s.duration_min, distance_km: s.distance_km, details: s.details,
    hf_zone: s.hf_zone, hf_range: s.hf_range, pace_speed: s.pace_speed,
    watts_indoor: s.watts_indoor, outdoor_alt: s.outdoor_alt,
    is_optional: s.is_optional, is_event: s.is_event, intensity_kind: s.intensity_kind,
    locked: false,
  }
}
function fromCalendarRun(e: CalendarEvent): DisplaySession {
  const durationMs = new Date(e.end).getTime() - new Date(e.start).getTime()
  const duration_min = !e.allDay && durationMs > 0 && durationMs < 8 * 3600000
    ? Math.round(durationMs / 60000) : null
  return {
    id: e.id, date: localDateFromEvent(e), sport: 'run', title: e.title,
    duration_min, distance_km: parseRunnaDistance(e.title),
    details: e.description ?? parseRunnaWorkoutType(e.title),
    hf_zone: null, hf_range: null, pace_speed: null, watts_indoor: null, outdoor_alt: null,
    is_optional: false, is_event: false, intensity_kind: null, locked: true,
  }
}

type DoneMap = Map<string, Set<string>>
function isDoneSport(date: string, sport: string, doneMap: DoneMap): boolean {
  const types = doneMap.get(date)
  if (!types) return false
  return (SPORT_TYPE_MAP[sport] ?? []).some((t) => types.has(t))
}

type DragState = { id: string; x: number; y: number; over: string | null } | null

type SlotCheckResult = {
  machbar: boolean
  ampel: 'grün' | 'gelb' | 'rot' | 'grau'
  einheit: { sport: string; intensitaet: string; dauer_min: number; zone: string; titel: string; beschreibung: string } | null
  begruendung: string
}

const AMPEL_COLOR: Record<string, string> = {
  grün: '#5bbd72', gelb: '#d4a017', rot: '#c0623b', grau: 'var(--ink-3)',
}
const SPORT_ICON_MAP: Record<string, string> = {
  swim: '🏊', bike: '🚴', run: '🏃', strength: '🏋',
}

export function MNextTraining() {
  const [sessions, setSessions] = useState<DisplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bikeMode, setBikeMode] = useState<Record<string, 'indoor' | 'outdoor'>>({})
  const [doneMap, setDoneMap] = useState<DoneMap>(new Map())
  const [drag, setDrag] = useState<DragState>(null)
  const dragSession = useRef<DisplaySession | null>(null)
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

  const loadDoneDates = useCallback(async () => {
    try {
      const res = await fetch('/api/garmin/done-dates')
      if (!res.ok) return
      const data: Array<{ date: string; type: string }> = await res.json()
      const map: DoneMap = new Map()
      for (const { date, type } of data) {
        if (!map.has(date)) map.set(date, new Set())
        map.get(date)!.add(type ?? '')
      }
      setDoneMap(map)
    } catch (e) { console.error('[m/next] done-dates error:', e) }
  }, [])

  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async (bust = false) => {
    try {
      const calUrl = bust ? '/api/calendar?days=14&bust=1' : '/api/calendar?days=14'
      const [planRes, calRes] = await Promise.all([
        fetch('/api/training/plan?days=14').then((r) => r.ok ? r.json() : { sessions: [] }),
        fetch(calUrl).then((r) => r.ok ? r.json() : []),
      ])
      const planSessions: DisplaySession[] = (Array.isArray(planRes?.sessions) ? planRes.sessions : []).map(fromPlan)
      const calEvents: CalendarEvent[] = Array.isArray(calRes) ? calRes : []
      const runEvents = calEvents.filter((e) => e.source !== 'training' && isCalendarRunEvent(e.title)).map(fromCalendarRun)
      const planIds = new Set(planSessions.map((s) => `${s.date}-${s.sport}`))
      const uniqueRuns = runEvents.filter((r) => !planIds.has(`${r.date}-run`))
      setSessions([...planSessions, ...uniqueRuns])
    } catch (e) {
      console.error('[m/next] fetch error:', e)
    } finally { setLoading(false) }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await loadData(true)
    setRefreshing(false)
  }

  useEffect(() => {
    loadData(); loadDoneDates()
    const onSync = () => { void loadDoneDates() }
    window.addEventListener('garmin-synced', onSync)
    return () => window.removeEventListener('garmin-synced', onSync)
  }, [loadData, loadDoneDates])

  // ── Drag-and-Drop (Touch via Pointer Events) ──────────────
  function slotUnder(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)?.closest('[data-date]') as HTMLElement | null
    return el?.getAttribute('data-date') ?? null
  }
  function onDragStart(s: DisplaySession, e: React.PointerEvent) {
    if (s.locked) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragSession.current = s
    setExpandedId(null)
    setDrag({ id: s.id, x: e.clientX, y: e.clientY, over: s.date })
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragSession.current) return
    e.preventDefault()
    if (e.clientY < 80) window.scrollBy(0, -12)
    else if (e.clientY > window.innerHeight - 80) window.scrollBy(0, 12)
    setDrag({ id: dragSession.current.id, x: e.clientX, y: e.clientY, over: slotUnder(e.clientX, e.clientY) })
  }
  async function onDragEnd(e: React.PointerEvent) {
    const s = dragSession.current
    dragSession.current = null
    const target = drag?.over ?? slotUnder(e.clientX, e.clientY)
    setDrag(null)
    if (!s || !target || target === s.date) return
    setSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, date: target } : x))
    try {
      const res = await fetch('/api/training/session', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, date: target }),
      })
      if (!res.ok) throw new Error('PATCH fehlgeschlagen')
    } catch (err) {
      console.error('[m/next] move error:', err)
      setSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, date: s.date } : x))
    }
  }

  const metricsFor = (s: DisplaySession, mode: 'indoor' | 'outdoor'): [string, string][] => {
    const rows: [string, string | null][] =
      s.sport === 'bike'
        ? mode === 'indoor'
          ? [['Watt', clean(s.watts_indoor)], ['HF-Zone', clean(s.hf_zone)], ['HF-Bereich', clean(s.hf_range)], ['Dauer', fmtDur(s.duration_min) || null]]
          : [['HF-Zone', clean(s.hf_zone)], ['HF-Bereich', clean(s.hf_range)], ['Tempo', clean(s.pace_speed)], ['Dauer', fmtDur(s.duration_min) || null], ['Distanz', s.distance_km ? `${s.distance_km} km` : null]]
        : [['HF-Zone', clean(s.hf_zone)], ['HF-Bereich', clean(s.hf_range)], ['Tempo', clean(s.pace_speed)], ['Watt', clean(s.watts_indoor)], ['Dauer', fmtDur(s.duration_min) || null], ['Distanz', s.distance_km ? `${s.distance_km} km` : null]]
    return rows.filter((r): r is [string, string] => r[1] != null)
  }

  // Sessions nach Datum gruppieren
  const byDate: Record<string, DisplaySession[]> = {}
  for (const s of sessions) (byDate[s.date] ??= []).push(s)

  const todayStr = localIso(new Date())
  const startWk = weekStart(todayStr)
  const weeks = [0, 1].map((i) => addDaysLocal(startWk, i * 7))
  const isDragging = !!drag

  return (
    <MCard label="Nächste Trainings" action={
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        style={{
          border: 'none', background: 'transparent', cursor: refreshing ? 'default' : 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.06em',
          color: refreshing ? 'var(--ink-3)' : 'var(--accent)', textTransform: 'uppercase', padding: '2px 4px',
        }}
      >
        {refreshing ? 'Lädt…' : '↻ Runna'}
      </button>
    }>
      {loading && <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Lädt…</div>}

      <div style={{ touchAction: isDragging ? 'none' : 'auto' }}>
        {!loading && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--ink-3)', letterSpacing: '0.04em', marginBottom: 10 }}>
            ☰ HALTEN &amp; ZIEHEN ZUM VERSCHIEBEN
          </div>
        )}

        {weeks.map((wk, wi) => {
          const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysLocal(wk, i))
          const visibleDays = days.filter((d) => d >= todayStr)
          if (visibleDays.length === 0) return null
          return (
            <div key={wk} style={{ marginBottom: 14 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.1em',
                color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8,
                borderBottom: '1px solid var(--line)', paddingBottom: 4,
              }}>
                {wi === 0 ? 'Diese Woche' : 'Nächste Woche'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleDays.map((day) => {
                  const items = (byDate[day] ?? []).slice().sort((a, b) => Number(a.is_optional) - Number(b.is_optional))
                  const isToday = day === todayStr
                  const isOver = drag?.over === day
                  return (
                    <div key={day} data-date={day} style={{
                      borderRadius: 10,
                      border: isOver ? '1.5px dashed var(--accent)' : '1.5px dashed transparent',
                      background: isOver ? 'rgba(192,98,59,0.06)' : 'transparent',
                      padding: isOver ? 4 : 0, transition: 'background .1s',
                    }}>
                      {/* Tag-Label */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: items.length ? 6 : 2, paddingLeft: 2 }}>
                        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.98rem', color: isToday ? 'var(--accent)' : 'var(--ink-1)' }}>
                          {wdFull(day)}{isToday ? ' · heute' : ''}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                          {dayNum(day)}. {monthShort(day)}
                        </span>
                      </div>

                      {items.length === 0 ? (
                        <div style={{ paddingLeft: 2 }}>
                          {isOver ? (
                            <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)', fontStyle: 'italic', opacity: 0.7 }}>Hier ablegen</div>
                          ) : (
                            <SlotCheckWidget date={day} result={slotChecks[day]} onCheck={() => checkSlot(day)} />
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {items.map((s) => (
                            <SessionCard
                              key={s.id} s={s}
                              done={isDoneSport(s.date, s.sport, doneMap)}
                              expanded={expandedId === s.id}
                              dragging={drag?.id === s.id}
                              bikeMode={bikeMode[s.id] ?? 'outdoor'}
                              onToggleExpand={() => setExpandedId(expandedId === s.id ? null : s.id)}
                              onBikeMode={(m) => setBikeMode((p) => ({ ...p, [s.id]: m }))}
                              metricsFor={metricsFor}
                              onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {!loading && sessions.length === 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)' }}>Nichts geplant</div>
        )}
      </div>

      {/* Schwebende Karte beim Ziehen */}
      {drag && dragSession.current && (
        <div style={{
          position: 'fixed', left: drag.x, top: drag.y, transform: 'translate(-50%, -50%) rotate(-2deg)',
          zIndex: 1000, pointerEvents: 'none', width: 'min(80vw, 320px)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.28)', opacity: 0.96,
        }}>
          <SessionCard
            s={dragSession.current} done={false} expanded={false} dragging={false}
            bikeMode="outdoor" ghost
            onToggleExpand={() => {}} onBikeMode={() => {}} metricsFor={metricsFor}
            onDragStart={() => {}} onDragMove={() => {}} onDragEnd={() => {}}
          />
        </div>
      )}
    </MCard>
  )
}

// ── Slot-Check Widget ─────────────────────────────────────
function SlotCheckWidget({ date, result, onCheck }: {
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
          padding: '5px 10px', cursor: 'pointer', background: 'transparent',
          fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.06em',
          color: 'var(--ink-3)', textTransform: 'uppercase',
        }}
      >
        💡 Einheit checken
      </button>
    )
  }
  if (result === 'loading') {
    return <div style={{ fontSize: '0.68rem', color: 'var(--ink-3)', fontStyle: 'italic' }}>Analysiere…</div>
  }
  if (result === 'error') {
    return <div style={{ fontSize: '0.68rem', color: 'var(--danger)' }}>Fehler — nochmal versuchen</div>
  }

  const ampelColor = AMPEL_COLOR[result.ampel] ?? 'var(--ink-3)'
  const e = result.einheit

  return (
    <div style={{
      border: `1.5px solid ${ampelColor}`, borderRadius: 10,
      background: `${ampelColor}12`, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
        <span style={{ fontSize: '1rem' }}>
          {result.ampel === 'grün' ? '✅' : result.ampel === 'gelb' ? '⚠️' : result.ampel === 'rot' ? '🛑' : '—'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {e ? (
            <>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-1)', fontWeight: 600 }}>
                {SPORT_ICON_MAP[e.sport] ?? '•'} {e.titel}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.05em' }}>
                {e.dauer_min} MIN · {e.zone} · {e.intensitaet.toUpperCase()}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-2)' }}>Besser pausieren</div>
          )}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.52rem', letterSpacing: '0.06em',
          textTransform: 'uppercase', color: ampelColor, fontWeight: 700,
        }}>
          {result.ampel}
        </span>
      </div>

      {/* Begründung + Beschreibung */}
      <div style={{ padding: '0 10px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: '0.74rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
          {result.begruendung}
        </div>
        {e?.beschreibung && (
          <div style={{
            fontSize: '0.72rem', color: 'var(--ink-3)', lineHeight: 1.5,
            borderLeft: `2px solid ${ampelColor}`, paddingLeft: 7, marginTop: 2,
          }}>
            {e.beschreibung}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Session-Karte ─────────────────────────────────────────
function SessionCard({
  s, done, expanded, dragging, bikeMode, ghost,
  onToggleExpand, onBikeMode, metricsFor, onDragStart, onDragMove, onDragEnd,
}: {
  s: DisplaySession
  done: boolean
  expanded: boolean
  dragging: boolean
  bikeMode: 'indoor' | 'outdoor'
  ghost?: boolean
  onToggleExpand: () => void
  onBikeMode: (m: 'indoor' | 'outdoor') => void
  metricsFor: (s: DisplaySession, mode: 'indoor' | 'outdoor') => [string, string][]
  onDragStart: (s: DisplaySession, e: React.PointerEvent) => void
  onDragMove: (e: React.PointerEvent) => void
  onDragEnd: (e: React.PointerEvent) => void
}) {
  const color = SPORT_COLOR[s.sport] ?? 'var(--ink-3)'
  const label = SPORT_LABEL[s.sport] ?? s.sport
  const icon = SPORT_ICON[s.sport] ?? '•'
  const meta = [fmtDur(s.duration_min), s.distance_km ? `${s.distance_km} km` : null].filter(Boolean).join(' · ')
  const metrics = metricsFor(s, bikeMode)

  return (
    <div style={{
      borderRadius: 11,
      border: `1.5px solid ${expanded ? 'var(--accent)' : 'var(--line)'}`,
      background: 'rgba(0,0,0,0.035)',
      opacity: dragging ? 0.35 : s.is_optional ? 0.9 : 1,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Body — tippen zum Aufklappen */}
        <div
          onClick={() => !ghost && onToggleExpand()}
          style={{ flex: 1, display: 'flex', gap: 9, padding: '9px 6px 9px 10px', cursor: ghost ? 'default' : 'pointer', minWidth: 0 }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1.1, flexShrink: 0 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', letterSpacing: '0.08em', color, textTransform: 'uppercase' }}>{label}</span>
              {s.is_optional && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>➕ optional</span>}
              {s.is_event && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', letterSpacing: '0.06em', color: 'var(--accent)', textTransform: 'uppercase' }}>🏁 Wettkampf</span>}
              {s.intensity_kind === 'interval' && !s.is_event && <span style={{ fontSize: '0.6rem' }}>⚡</span>}
              {s.intensity_kind === 'technique' && <span style={{ fontSize: '0.6rem' }}>🎯</span>}
              {done && (
                <span style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: '#5bbd72', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}>✓</span>
              )}
              {s.locked && !done && (
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--ink-3)', letterSpacing: '0.06em' }}>RUNNA</span>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-1)', lineHeight: 1.3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title}
            </div>
            {meta && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--ink-3)', marginTop: 2 }}>{meta}</div>}
          </div>
        </div>

        {/* Greif-Griff (nicht bei Runna/Ghost) */}
        {!ghost && !s.locked && (
          <div
            onPointerDown={(e) => onDragStart(s, e)}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, flexShrink: 0, cursor: 'grab', touchAction: 'none', color: 'var(--ink-3)', fontSize: '1.1rem', borderLeft: '1px solid var(--line)', userSelect: 'none' }}
          >
            ☰
          </div>
        )}
      </div>

      {/* Aufgeklappt */}
      {expanded && !ghost && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {s.sport === 'bike' && (
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.06)', borderRadius: 9, padding: 3, gap: 3, alignSelf: 'flex-start' }}>
              {(['outdoor', 'indoor'] as const).map((mo) => (
                <button key={mo} onClick={() => onBikeMode(mo)} style={{
                  border: 'none', borderRadius: 7, padding: '5px 14px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.06em',
                  background: bikeMode === mo ? 'var(--accent)' : 'transparent',
                  color: bikeMode === mo ? '#FBF3EC' : 'var(--ink-2)',
                }}>
                  {mo === 'outdoor' ? 'OUTDOOR' : 'INDOOR'}
                </button>
              ))}
            </div>
          )}

          {metrics.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
              {metrics.map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.76rem' }}>
                  <span style={{ color: 'var(--ink-3)' }}>{l}</span>
                  <span style={{ color: 'var(--ink-1)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {clean(s.details) && (
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>{s.details}</div>
          )}

          {clean(s.outdoor_alt) && (
            <div style={{ fontSize: '0.76rem', color: 'var(--ink-2)', lineHeight: 1.5, borderLeft: `2px solid ${SPORT_COLOR.run}`, paddingLeft: 8 }}>
              <span style={{ fontWeight: 600 }}>🌳 Outdoor: </span>{s.outdoor_alt}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

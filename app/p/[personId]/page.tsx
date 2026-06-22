'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import UteChat from './UteChat'
import MarkusRecovery from './MarkusRecovery'
import MarkusActivities from './MarkusActivities'

// ── Farben: Mint (p1) ───────────────────────────────────────
const SPORT_LIGHT: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  running:  { bg: '#E8F7EE', border: '#4CAF82', text: '#1A5C3A', icon: '🏃', label: 'Laufen' },
  cycling:  { bg: '#FEF5E4', border: '#E8A44A', text: '#7A4A10', icon: '🚴', label: 'Rolle' },
  swimming: { bg: '#E4F2FB', border: '#5B9FD4', text: '#1A4A6E', icon: '🏊', label: 'Schwimmen' },
}
const OPT_LIGHT   = { bg: '#F5F0E8', border: '#C4BAA8', text: '#7A6E5E', icon: '➕', label: 'Optional' }
const EVENT_LIGHT = { bg: '#FDECEA', border: '#D9534F', text: '#8A2A22', icon: '🏁', label: 'Wettkampf' }

// ── Farben: Nautisch (p2+) ──────────────────────────────────
const SPORT_DARK: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  running:  { bg: 'rgba(61,155,120,0.08)', border: '#3D9B78', text: '#3D9B78', icon: '🏃', label: 'Laufen' },
  cycling:  { bg: 'rgba(196,151,58,0.08)', border: '#C4973A', text: '#C4973A', icon: '🚴', label: 'Rad' },
  swimming: { bg: 'rgba(91,159,212,0.08)', border: '#5B9FD4', text: '#5B9FD4', icon: '🏊', label: 'Schwimmen' },
}
const OPT_DARK   = { bg: 'rgba(61,82,101,0.25)',  border: '#3D5265', text: '#7A8FA5', icon: '➕', label: 'Optional' }
const EVENT_DARK = { bg: 'rgba(155,64,64,0.12)',  border: '#9B4040', text: '#C47070', icon: '🏁', label: 'Wettkampf' }

function sportStyle(s: Session, dark = false) {
  const SPORT = dark ? SPORT_DARK : SPORT_LIGHT
  const OPT   = dark ? OPT_DARK   : OPT_LIGHT
  const EVENT = dark ? EVENT_DARK  : EVENT_LIGHT
  if (s.is_event) return EVENT
  if (s.is_optional) return OPT
  return SPORT[s.sport] ?? OPT
}

// ── Datum-Helfer (lokale Zeit, kein UTC-Drift) ───────────────
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function parseDate(str: string) { return new Date(str + 'T12:00:00') }
function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(dateStr: string, n: number) {
  const d = parseDate(dateStr); d.setDate(d.getDate() + n); return localIso(d)
}
function weekStart(dateStr: string) {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Montag
  return localIso(d)
}
function weekLabel(wk: string) {
  const d = parseDate(wk); const end = parseDate(addDays(wk, 6))
  return `${d.getDate()}. ${MONATE[d.getMonth()]} – ${end.getDate()}. ${MONATE[end.getMonth()]}`
}
function weekNumber(wk: string) {
  const planStart = new Date('2026-06-15T12:00:00') // Montag der Planstart-Woche (21.06. = So → Woche 1)
  return Math.round((parseDate(wk).getTime() - planStart.getTime()) / (7 * 864e5)) + 1
}

// ── Types ────────────────────────────────────────────────
type Session = {
  id: string; date: string; sport: string; title: string; duration_min: number
  hf_zone: string; hf_range: string | null; details: string | null
  is_optional: boolean; is_event: boolean; outdoor_alt: string | null
  completed_at: string | null; garmin_done: boolean; intensity_kind: string
  locked?: boolean; source?: string
  ramp_factor?: number | null; ramp_note?: string | null
}
type DragState = { id: string; x: number; y: number; over: string | null } | null

// ── Komponente ────────────────────────────────────────────
export default function UpcomingPage() {
  const { personId } = useParams<{ personId: string }>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [marking, setMarking] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [sickSince, setSickSince] = useState<string | null>(null)
  const [sickBusy, setSickBusy] = useState(false)
  const dragSession = useRef<Session | null>(null)

  function loadPlan() {
    return fetch(`/api/p/${personId}/plan?mode=upcoming`)
      .then(r => r.json())
      .then(d => { setSessions(d.sessions ?? []); setSickSince(d.sick_since ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { loadPlan() }, [personId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleSick(active: boolean) {
    setSickBusy(true)
    const res = await fetch(`/api/p/${personId}/sick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    if (res.ok) await loadPlan()
    setSickBusy(false)
  }

  async function toggleDone(s: Session) {
    setMarking(s.id)
    const done = !s.completed_at
    const res = await fetch(`/api/p/${personId}/done`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: s.id, done }),
    })
    if (res.ok) setSessions(prev => prev.map(x => x.id === s.id ? { ...x, completed_at: done ? new Date().toISOString() : null } : x))
    setMarking(null)
  }

  // ── Drag-and-Drop (Touch + Maus via Pointer Events) ───────
  function slotUnder(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)?.closest('[data-date]') as HTMLElement | null
    return el?.getAttribute('data-date') ?? null
  }
  function onDragStart(s: Session, e: React.PointerEvent) {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragSession.current = s
    setExpanded(null)
    setDrag({ id: s.id, x: e.clientX, y: e.clientY, over: s.date })
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragSession.current) return
    e.preventDefault()
    // Auto-Scroll an den Rändern
    if (e.clientY < 70) window.scrollBy(0, -14)
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14)
    setDrag({ id: dragSession.current.id, x: e.clientX, y: e.clientY, over: slotUnder(e.clientX, e.clientY) })
  }
  async function onDragEnd(e: React.PointerEvent) {
    const s = dragSession.current
    dragSession.current = null
    const target = drag?.over ?? slotUnder(e.clientX, e.clientY)
    setDrag(null)
    if (!s || !target || target === s.date) return
    // Optimistisch verschieben
    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, date: target } : x))
    const res = await fetch(`/api/p/${personId}/move`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: s.id, date: target }),
    })
    if (!res.ok) {
      // Rollback bei Fehler
      setSessions(prev => prev.map(x => x.id === s.id ? { ...x, date: s.date } : x))
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', marginTop: '4rem', color: '#7A6E5E' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
      <p style={{ fontSize: '1rem' }}>Lädt…</p>
    </div>
  )

  // Sessions nach Datum gruppieren
  const byDate: Record<string, Session[]> = {}
  for (const s of sessions) (byDate[s.date] ??= []).push(s)

  const todayStr = localIso(new Date())
  const startWk = weekStart(todayStr)
  const weeks = [0, 1, 2, 3].map(i => addDays(startWk, i * 7))
  const isDragging = !!drag

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem', touchAction: isDragging ? 'none' : 'auto' }}>
      {/* Recovery + letzte Aktivitäten nur für TP-Athleten */}
      {personId !== 'p1' && <MarkusRecovery personId={personId} />}
      {personId !== 'p1' && <MarkusActivities personId={personId} />}

      <p style={{ fontSize: '0.78rem', color: '#9A8E7E', textAlign: 'center', margin: '-0.4rem 0 0' }}>
        ☰ gedrückt halten und ziehen, um eine Einheit auf einen anderen Tag zu verschieben
      </p>

      {/* Krank-Knopf / Ramp-Banner */}
      {sickSince ? (
        <div style={{ background: '#FFF3E0', border: '1.5px solid #F5A623', borderRadius: 12, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <span style={{ fontSize: '1.3rem' }}>🤒</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#A05A00' }}>
              Krank seit {parseDate(sickSince).getDate()}. {MONATE[parseDate(sickSince).getMonth()]}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#7A5A2E', marginTop: 2 }}>
              Nächste 3 Trainingseinheiten werden sanft hochgefahren (60% → 75% → 90%)
            </div>
          </div>
          <button
            onClick={() => toggleSick(false)}
            disabled={sickBusy}
            style={{ background: '#2D7A5F', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 0.9rem', fontWeight: 700, fontSize: '0.8rem', cursor: sickBusy ? 'wait' : 'pointer', opacity: sickBusy ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            {sickBusy ? '…' : '✓ Wieder gesund'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => toggleSick(true)}
            disabled={sickBusy}
            style={{ background: '#F5F0E8', border: '1.5px solid #D4C9B8', borderRadius: 10, padding: '0.5rem 1.2rem', color: '#7A6E5E', fontSize: '0.82rem', fontWeight: 600, cursor: sickBusy ? 'wait' : 'pointer', opacity: sickBusy ? 0.6 : 1 }}
          >
            {sickBusy ? '…' : '🤒 Ich war krank'}
          </button>
        </div>
      )}

      {weeks.map(wk => {
        const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(wk, i))
        return (
          <section key={wk}>
            {/* Wochen-Header */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '0.6rem',
              marginBottom: '0.7rem', paddingBottom: '0.45rem',
              borderBottom: personId !== 'p1' ? '1px solid rgba(196,151,58,0.2)' : '2px solid #D4C9B8',
            }}>
              <span style={{
                fontSize: '0.68rem', fontWeight: personId !== 'p1' ? 400 : 800,
                fontFamily: personId !== 'p1' ? MONO_FONT : 'inherit',
                color: personId !== 'p1' ? '#C4973A' : '#2D7A5F',
                letterSpacing: personId !== 'p1' ? '0.14em' : '0.1em', textTransform: 'uppercase',
              }}>
                {personId !== 'p1' ? `KW ${weekNumber(wk)}` : `WOCHE ${weekNumber(wk)}`}
              </span>
              <span style={{
                fontSize: '0.85rem', color: personId !== 'p1' ? '#3D5265' : '#9A8E7E',
                fontFamily: personId !== 'p1' ? SERIF_FONT : 'inherit',
                fontWeight: 400,
              }}>{weekLabel(wk)}</span>
            </div>

            {/* Tage als Drop-Slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {days.map(day => {
                const items = (byDate[day] ?? []).sort((a, b) => Number(a.is_optional) - Number(b.is_optional))
                const isPast = day < todayStr
                if (isPast && items.length === 0) return null // leere Vergangenheit ausblenden
                const isToday = day === todayStr
                const isOver = drag?.over === day
                const d = parseDate(day)
                return (
                  <div
                    key={day}
                    data-date={day}
                    style={{
                      borderRadius: 12,
                      border: isOver ? '2px dashed #2D7A5F' : '2px dashed transparent',
                      background: isOver ? 'rgba(45,122,95,0.06)' : 'transparent',
                      padding: isOver ? '0.3rem' : '0.3rem 0',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Tag-Label */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', padding: '0 0.2rem 0.3rem', opacity: isPast ? 0.5 : 1 }}>
                      <span style={{
                        fontSize: personId !== 'p1' ? '0.68rem' : '0.82rem',
                        fontWeight: personId !== 'p1' ? 400 : 800,
                        fontFamily: personId !== 'p1' ? MONO_FONT : 'inherit',
                        letterSpacing: personId !== 'p1' ? '0.1em' : 0,
                        color: isToday ? (personId !== 'p1' ? '#C4973A' : '#2D7A5F') : (personId !== 'p1' ? '#3D5265' : '#5A5044'),
                      }}>
                        {WOCHENTAGE[d.getDay()]}{isToday ? ' · heute' : ''}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#9A8E7E' }}>{d.getDate()}. {MONATE[d.getMonth()]}</span>
                    </div>

                    {items.length === 0 ? (
                      <div style={{
                        fontSize: '0.78rem', color: '#B8AE9E', fontStyle: 'italic',
                        padding: '0.4rem 0.6rem', borderRadius: 10, border: '1.5px dashed #E0D8CA',
                      }}>
                        {isOver ? 'Hier ablegen' : 'Ruhetag'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {items.map(s => (
                          <SessionCard
                            key={s.id} s={s}
                            expanded={expanded} setExpanded={setExpanded}
                            marking={marking} onToggle={toggleDone}
                            isDraggingThis={drag?.id === s.id}
                            onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd}
                            dark={personId !== 'p1'}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* Chat-Assistent */}
      <UteChat personId={personId} onPlanChanged={loadPlan} />

      {/* Schwebende Karte beim Ziehen */}
      {drag && dragSession.current && (
        <div style={{
          position: 'fixed', left: drag.x, top: drag.y, transform: 'translate(-50%, -50%) rotate(-2deg)',
          zIndex: 1000, pointerEvents: 'none', width: 'min(86vw, 380px)',
          boxShadow: '0 12px 28px rgba(0,0,0,0.25)', opacity: 0.95,
        }}>
          <SessionCard
            s={dragSession.current} expanded={null} setExpanded={() => {}}
            marking={null} onToggle={() => {}} ghost
            isDraggingThis={false}
            onDragStart={() => {}} onDragMove={() => {}} onDragEnd={() => {}}
          />
        </div>
      )}
    </div>
  )
}

// ── Session-Karte ─────────────────────────────────────────
const MONO_FONT = "'Space Mono', monospace"
const SERIF_FONT = "'IM Fell English SC', Georgia, serif"

function SessionCard({ s, expanded, setExpanded, marking, onToggle, ghost, isDraggingThis, onDragStart, onDragMove, onDragEnd, dark = false }: {
  s: Session
  expanded: string | null
  setExpanded: (id: string | null) => void
  marking: string | null
  onToggle: (s: Session) => void
  ghost?: boolean
  isDraggingThis: boolean
  onDragStart: (s: Session, e: React.PointerEvent) => void
  onDragMove: (e: React.PointerEvent) => void
  onDragEnd: (e: React.PointerEvent) => void
  dark?: boolean
}) {
  const st   = sportStyle(s, dark)
  const done = !!s.completed_at || s.garmin_done
  const isOpen = expanded === s.id

  const cardBg     = dark ? (done ? '#0D1828' : '#111E30')     : (done ? '#F5F0E8' : '#FDFCF9')
  const cardBorder = dark
    ? `1px solid ${done ? 'rgba(255,255,255,0.04)' : isOpen || s.is_event ? st.border : 'rgba(255,255,255,0.07)'}`
    : `2px solid ${done ? '#D4C9B8' : isOpen ? st.border : s.is_event ? st.border : '#E8E0D4'}`
  const titleCol  = dark ? (done ? '#3D5265' : '#D8CFC0') : (done ? '#9A8E7E' : s.is_event ? st.text : '#2A3828')
  const detailBg  = dark ? '#0B1520' : '#FDFCF9'
  const descBg    = dark ? 'rgba(255,255,255,0.03)' : '#F5F0E8'
  const descText  = dark ? '#7A8FA5' : '#4A5040'
  const gripCol   = dark ? '#3D5265' : '#C4BAA8'
  const gripBorder = dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #EFE9DF'

  return (
    <div style={{
      background: cardBg,
      borderRadius: dark ? 8 : 14,
      border: cardBorder,
      borderLeft: dark ? `3px solid ${done ? '#1A2A3E' : st.border}` : undefined,
      overflow: 'hidden',
      opacity: done ? (dark ? 0.55 : 0.72) : isDraggingThis ? 0.35 : 1,
      transition: 'border-color 0.15s, opacity 0.1s',
    }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Hauptbereich (tippen zum Aufklappen) */}
        <button
          onClick={() => !ghost && setExpanded(isOpen ? null : s.id)}
          style={{ flex: 1, display: 'flex', alignItems: 'stretch', background: 'none', border: 'none', cursor: ghost ? 'default' : 'pointer', textAlign: 'left', padding: 0, minWidth: 0 }}
        >
          {/* Linker Bereich: Icon + Label (light) oder nur Padding (dark — Border übernimmt Farbe) */}
          {!dark && (
            <div style={{
              width: 56, minWidth: 56, background: done ? '#E8E0D4' : st.bg,
              borderRight: `2px solid ${done ? '#D4C9B8' : st.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.8rem 0.2rem',
            }}>
              <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{st.icon}</span>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: done ? '#9A8E7E' : st.text, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {st.label}
              </span>
            </div>
          )}

          {/* Inhalt */}
          <div style={{ flex: 1, padding: dark ? '0.7rem 0.6rem 0.7rem 0.9rem' : '0.75rem 0.6rem 0.75rem 0.85rem', minWidth: 0 }}>
            {dark && (
              <div style={{ fontFamily: MONO_FONT, fontSize: '0.62rem', color: done ? '#3D5265' : st.text, letterSpacing: '0.12em', marginBottom: 4 }}>
                {st.label.toUpperCase()}{s.is_event ? ' · WETTKAMPF' : ''}
              </div>
            )}
            <div style={{
              fontSize: dark ? '0.95rem' : '0.92rem',
              fontFamily: dark ? SERIF_FONT : 'inherit',
              fontWeight: dark ? 400 : (s.is_event ? 800 : 600),
              color: titleCol,
              lineHeight: 1.35,
              textDecoration: done ? 'line-through' : 'none',
              marginBottom: '0.35rem',
            }}>
              {s.title}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {dark ? (
                <>
                  <span style={{ fontFamily: MONO_FONT, fontSize: '0.68rem', color: done ? '#3D5265' : '#C4973A' }}>
                    {s.duration_min} min
                  </span>
                  {s.hf_zone && (
                    <span style={{ fontFamily: MONO_FONT, fontSize: '0.68rem', color: '#3D5265' }}>
                      {s.hf_zone}{s.hf_range ? ` · ${s.hf_range}` : ''}
                    </span>
                  )}
                  {!s.is_event && s.intensity_kind === 'interval' && (
                    <span style={{ fontFamily: MONO_FONT, fontSize: '0.68rem', color: '#9B4040' }}>INTERVALL</span>
                  )}
                  {s.intensity_kind === 'technique' && (
                    <span style={{ fontFamily: MONO_FONT, fontSize: '0.68rem', color: '#5B9FD4' }}>TECHNIK</span>
                  )}
                  {done && <span style={{ marginLeft: 'auto', color: '#3D9B78', fontFamily: MONO_FONT, fontSize: '0.68rem' }}>DONE</span>}
                </>
              ) : (
                <>
                  <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#2D7A5F', background: '#D4EDDF', borderRadius: 6, padding: '2px 7px' }}>
                    {s.duration_min} min
                  </span>
                  {s.hf_zone && (
                    <span style={{ fontSize: '0.76rem', color: '#7A6E5E', background: '#EDE8DF', borderRadius: 6, padding: '2px 7px' }}>
                      HF {s.hf_zone}{s.hf_range ? ` · ${s.hf_range}` : ''}
                    </span>
                  )}
                  {s.is_event && (
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#8A2A22', background: '#FBD7D2', borderRadius: 6, padding: '2px 7px' }}>🏁 Wettkampf</span>
                  )}
                  {!s.is_event && s.intensity_kind === 'interval' && (
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#B83A2E', background: '#FDECEA', borderRadius: 6, padding: '2px 7px' }}>⚡ Intervall</span>
                  )}
                  {s.intensity_kind === 'technique' && (
                    <span style={{ fontSize: '0.74rem', color: '#1A4A6E', background: '#E4F2FB', borderRadius: 6, padding: '2px 7px' }}>🎯 Technik</span>
                  )}
                  {s.locked && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5A4A8A', background: '#ECE6F7', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.04em' }}>RUNNA</span>
                  )}
                  {done && <span style={{ fontSize: '1.1rem', marginLeft: 'auto' }}>✅</span>}
                </>
              )}
            </div>
          </div>
        </button>

        {/* Greif-Griff zum Ziehen (nicht bei gesperrten Runna-Läufen) */}
        {!ghost && !s.locked && (
          <div
            onPointerDown={e => onDragStart(s, e)}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onClick={e => e.stopPropagation()}
            title="Ziehen zum Verschieben"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 42, minWidth: 42, cursor: 'grab', touchAction: 'none',
              color: gripCol, fontSize: '1.3rem', borderLeft: gripBorder, userSelect: 'none',
            }}
          >
            ☰
          </div>
        )}
      </div>

      {/* Aufgeklappt: Details */}
      {isOpen && !ghost && (
        <div style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : st.bg}`, padding: '0.9rem 1rem 1rem 1.1rem', background: detailBg }}>
          {s.details && (
            <p style={{
              fontSize: dark ? '0.83rem' : '0.88rem',
              fontFamily: dark ? SERIF_FONT : 'inherit',
              color: descText, lineHeight: 1.7,
              background: descBg, borderRadius: dark ? 6 : 10,
              padding: '0.7rem 0.9rem',
              margin: '0 0 0.8rem',
              borderLeft: `3px solid ${st.border}`,
            }}>
              {s.details}
            </p>
          )}

          {s.outdoor_alt && (
            <p style={{
              fontSize: '0.86rem', color: dark ? '#3D9B78' : '#3A5A2E', lineHeight: 1.6,
              background: dark ? 'rgba(61,155,120,0.07)' : '#EAF4E2',
              borderRadius: dark ? 6 : 10, padding: '0.7rem 0.9rem',
              margin: '0 0 0.8rem', borderLeft: '3px solid #3D9B78',
              fontFamily: dark ? SERIF_FONT : 'inherit',
            }}>
              <span style={{ fontWeight: dark ? 400 : 700 }}>Outdoor: </span>{s.outdoor_alt}
            </p>
          )}

          {s.ramp_note && (
            <p style={{ fontSize: '0.82rem', color: '#7A4A10', background: '#FEF5E4', borderRadius: 8, padding: '0.6rem 0.85rem', margin: '0 0 0.75rem', borderLeft: '3px solid #E8A44A' }}>
              ⚠️ {s.ramp_note}
            </p>
          )}

          {s.garmin_done && !s.completed_at && (
            <p style={{ fontSize: '0.82rem', color: '#2D7A5F', margin: '0 0 0.7rem', fontWeight: 600 }}>
              📡 Garmin hat eine passende Aktivität erkannt
            </p>
          )}

          {s.locked && !s.garmin_done && (
            <p style={{ fontSize: '0.82rem', color: '#5A4A8A', margin: 0, fontWeight: 600 }}>
              🏃 Aus Runna · wird automatisch abgehakt, sobald die Garmin-Aktivität vorliegt
            </p>
          )}

          {!s.garmin_done && !s.locked && (
            <button
              onClick={() => onToggle(s)}
              disabled={marking === s.id}
              style={{
                width: '100%', padding: '0.8rem', borderRadius: 10, border: 'none',
                cursor: marking === s.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.95rem',
                background: s.completed_at ? '#E8E0D4' : '#2D7A5F',
                color: s.completed_at ? '#7A6E5E' : '#FFFFFF',
                opacity: marking === s.id ? 0.6 : 1,
              }}
            >
              {marking === s.id ? '…' : s.completed_at ? '✓ Erledigt — rückgängig?' : '✓ Als erledigt markieren'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

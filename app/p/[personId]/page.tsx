'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

// ── Farben ──────────────────────────────────────────────────
const SPORT: Record<string, { bg: string; border: string; text: string; dot: string; icon: string; label: string }> = {
  running:  { bg: '#E8F7EE', border: '#4CAF82', text: '#1A5C3A', dot: '#4CAF82', icon: '🏃', label: 'Laufen' },
  cycling:  { bg: '#FEF5E4', border: '#E8A44A', text: '#7A4A10', dot: '#E8A44A', icon: '🚴', label: 'Rolle' },
  swimming: { bg: '#E4F2FB', border: '#5B9FD4', text: '#1A4A6E', dot: '#5B9FD4', icon: '🏊', label: 'Schwimmen' },
}
const OPT = { bg: '#F5F0E8', border: '#C4BAA8', text: '#7A6E5E', dot: '#C4BAA8', icon: '➕', label: 'Optional' }

function sportStyle(sport: string, optional: boolean) {
  return optional ? OPT : (SPORT[sport] ?? OPT)
}

// ── Datum-Helfer ──────────────────────────────────────────
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function parseDate(str: string) { return new Date(str + 'T12:00:00') }

function weekStart(dateStr: string) {
  const d = parseDate(dateStr)
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return mon.toISOString().split('T')[0]
}

function weekLabel(wk: string) {
  const d = parseDate(wk)
  const end = new Date(d); end.setDate(d.getDate() + 6)
  return `${d.getDate()}. ${MONATE[d.getMonth()]} – ${end.getDate()}. ${MONATE[end.getMonth()]}`
}

function weekNumber(wk: string) {
  // Wochennummer relativ zum Planstart (21.06.2026)
  const planStart = new Date('2026-06-21T12:00:00')
  const d = parseDate(wk)
  return Math.round((d.getTime() - planStart.getTime()) / (7 * 24 * 3600 * 1000)) + 1
}

// ── Types ────────────────────────────────────────────────
type Session = {
  id: string; date: string; sport: string; title: string; duration_min: number
  hf_zone: string; hf_range: string | null; details: string | null
  is_optional: boolean; completed_at: string | null; garmin_done: boolean
  intensity_kind: string
}

// ── Komponente ────────────────────────────────────────────
export default function UpcomingPage() {
  const { personId } = useParams<{ personId: string }>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [marking, setMarking] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/p/${personId}/plan?mode=upcoming`)
      .then(r => r.json())
      .then(d => { setSessions(d.sessions ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [personId])

  async function toggleDone(s: Session) {
    setMarking(s.id)
    const done = !s.completed_at
    const res = await fetch(`/api/p/${personId}/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: s.id, done }),
    })
    if (res.ok) setSessions(prev => prev.map(x => x.id === s.id ? { ...x, completed_at: done ? new Date().toISOString() : null } : x))
    setMarking(null)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', marginTop: '4rem', color: '#7A6E5E' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
      <p style={{ fontSize: '1rem' }}>Lädt…</p>
    </div>
  )

  // Wochen gruppieren
  const weeks: Record<string, Session[]> = {}
  for (const s of sessions) {
    const wk = weekStart(s.date)
    if (!weeks[wk]) weeks[wk] = []
    weeks[wk].push(s)
  }

  // Nur nächste 4 Wochen anzeigen
  const weekEntries = Object.entries(weeks).slice(0, 4)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {weekEntries.map(([wk, wkSessions]) => {
        const wkNr = weekNumber(wk)
        const kern = wkSessions.filter(s => !s.is_optional)
        const opt  = wkSessions.filter(s => s.is_optional)

        return (
          <section key={wk}>
            {/* Wochen-Header */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '0.6rem',
              marginBottom: '0.9rem', paddingBottom: '0.5rem',
              borderBottom: '2px solid #D4C9B8',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2D7A5F', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                WOCHE {wkNr}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#9A8E7E', fontWeight: 500 }}>{weekLabel(wk)}</span>
            </div>

            {/* Kern-Einheiten */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {kern.map(s => <SessionCard key={s.id} s={s} expanded={expanded} setExpanded={setExpanded} marking={marking} onToggle={toggleDone} />)}
            </div>

            {/* Optionale Einheiten (kollabierbar) */}
            {opt.length > 0 && (
              <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#9A8E7E', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                  + Optional
                </div>
                {opt.map(s => <SessionCard key={s.id} s={s} expanded={expanded} setExpanded={setExpanded} marking={marking} onToggle={toggleDone} />)}
              </div>
            )}
          </section>
        )
      })}

      {weekEntries.length === 0 && (
        <p style={{ textAlign: 'center', color: '#9A8E7E', marginTop: '3rem', fontSize: '1rem' }}>Keine Einheiten geplant.</p>
      )}
    </div>
  )
}

// ── Session-Karte ─────────────────────────────────────────
function SessionCard({ s, expanded, setExpanded, marking, onToggle }: {
  s: Session
  expanded: string | null
  setExpanded: (id: string | null) => void
  marking: string | null
  onToggle: (s: Session) => void
}) {
  const st = sportStyle(s.sport, s.is_optional)
  const done = !!s.completed_at || s.garmin_done
  const isOpen = expanded === s.id
  const d = new Date(s.date + 'T12:00:00')
  const wochentag = WOCHENTAGE[d.getDay()]
  const datum = `${d.getDate()}. ${['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][d.getMonth()]}`

  return (
    <div style={{
      background: done ? '#F5F0E8' : '#FDFCF9',
      borderRadius: 14,
      border: `2px solid ${done ? '#D4C9B8' : isOpen ? st.border : '#E8E0D4'}`,
      overflow: 'hidden',
      opacity: done ? 0.72 : 1,
      transition: 'border-color 0.15s',
    }}>
      {/* Haupt-Zeile */}
      <button
        onClick={() => setExpanded(isOpen ? null : s.id)}
        style={{ width: '100%', display: 'flex', alignItems: 'stretch', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
      >
        {/* Farbiger linker Balken + Tag */}
        <div style={{
          width: 72, minWidth: 72, background: done ? '#E8E0D4' : st.bg,
          borderRight: `2px solid ${done ? '#D4C9B8' : st.border}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '0.9rem 0.3rem',
        }}>
          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{st.icon}</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: done ? '#9A8E7E' : st.text, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {st.label}
          </span>
        </div>

        {/* Inhalt */}
        <div style={{ flex: 1, padding: '0.85rem 0.9rem 0.85rem 1rem' }}>
          {/* Tag + Datum */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: done ? '#9A8E7E' : '#1A2B22' }}>{wochentag}</span>
            <span style={{ fontSize: '0.8rem', color: '#9A8E7E', fontWeight: 500 }}>{datum}</span>
          </div>
          {/* Titel */}
          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: done ? '#9A8E7E' : '#2A3828', lineHeight: 1.35, textDecoration: done ? 'line-through' : 'none', marginBottom: '0.3rem' }}>
            {s.title}
          </div>
          {/* Chips */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2D7A5F', background: '#D4EDDF', borderRadius: 6, padding: '2px 8px' }}>
              {s.duration_min} min
            </span>
            {s.hf_zone && (
              <span style={{ fontSize: '0.78rem', color: '#7A6E5E', background: '#EDE8DF', borderRadius: 6, padding: '2px 8px' }}>
                HF {s.hf_zone}{s.hf_range ? ` · ${s.hf_range}` : ''}
              </span>
            )}
            {s.intensity_kind === 'interval' && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B83A2E', background: '#FDECEA', borderRadius: 6, padding: '2px 8px' }}>⚡ Intervall</span>
            )}
            {s.intensity_kind === 'technique' && (
              <span style={{ fontSize: '0.75rem', color: '#1A4A6E', background: '#E4F2FB', borderRadius: 6, padding: '2px 8px' }}>🎯 Technik</span>
            )}
          </div>
        </div>

        {/* Rechts: Done + Chevron */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 0.9rem 0 0.2rem', gap: 6 }}>
          {done && <span style={{ fontSize: '1.3rem' }}>✅</span>}
          <span style={{ color: '#C4BAA8', fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Aufgeklappt: Details */}
      {isOpen && (
        <div style={{ borderTop: `1px solid ${st.bg}`, padding: '1rem 1rem 1rem 1.2rem', background: '#FDFCF9' }}>
          {s.details && (
            <p style={{
              fontSize: '0.88rem', color: '#4A5040', lineHeight: 1.7,
              background: '#F5F0E8', borderRadius: 10, padding: '0.75rem 1rem',
              margin: '0 0 0.9rem', borderLeft: `3px solid ${st.border}`,
            }}>
              {s.details}
            </p>
          )}

          {s.garmin_done && !s.completed_at && (
            <p style={{ fontSize: '0.82rem', color: '#2D7A5F', margin: '0 0 0.7rem', fontWeight: 600 }}>
              📡 Garmin hat heute eine passende Aktivität erkannt
            </p>
          )}

          {!s.garmin_done && (
            <button
              onClick={() => onToggle(s)}
              disabled={marking === s.id}
              style={{
                width: '100%', padding: '0.8rem', borderRadius: 10, border: 'none',
                cursor: marking === s.id ? 'wait' : 'pointer',
                fontWeight: 700, fontSize: '0.95rem',
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

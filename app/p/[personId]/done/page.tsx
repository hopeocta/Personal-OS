'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import MarkusActivities from '../MarkusActivities'

const SPORT_LIGHT: Record<string, { bg: string; border: string; text: string; icon: string; label: string; statLabel: string }> = {
  running:  { bg: '#E8F7EE', border: '#4CAF82', text: '#1A5C3A', icon: '🏃', label: 'Laufen',     statLabel: 'Läufe' },
  cycling:  { bg: '#FEF5E4', border: '#E8A44A', text: '#7A4A10', icon: '🚴', label: 'Rolle',      statLabel: 'Rolle' },
  swimming: { bg: '#E4F2FB', border: '#5B9FD4', text: '#1A4A6E', icon: '🏊', label: 'Schwimmen', statLabel: 'Schwimmen' },
}
const SPORT_DARK: Record<string, { bg: string; border: string; text: string; icon: string; label: string; statLabel: string }> = {
  running:  { bg: 'rgba(61,155,120,0.08)', border: '#3D9B78', text: '#3D9B78', icon: '🏃', label: 'Laufen',     statLabel: 'Läufe' },
  cycling:  { bg: 'rgba(196,151,58,0.08)',  border: '#C4973A', text: '#C4973A', icon: '🚴', label: 'Rad',        statLabel: 'Rad' },
  swimming: { bg: 'rgba(91,159,212,0.08)',  border: '#5B9FD4', text: '#5B9FD4', icon: '🏊', label: 'Schwimmen', statLabel: 'Schwimmen' },
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const MONO = "'Space Mono', monospace"
const SERIF = "'IM Fell English SC', Georgia, serif"

type Session = {
  id: string; date: string; sport: string; title: string; duration_min: number
  hf_zone: string; completed_at: string | null; garmin_done: boolean; is_optional: boolean
  actual_hr: number | null; actual_min: number | null; actual_tss: number | null
}

function FeedbackStrip({ sessionId, personId, dark, borderColor }: { sessionId: string; personId: string; dark: boolean; borderColor: string }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  const MONO = "'Space Mono', monospace"
  const accentCol = dark ? '#C4973A' : '#2D7A5F'
  const feedbackBg = dark ? 'rgba(61,155,120,0.07)' : '#EAF3DE'
  const feedbackText = dark ? '#3D9B78' : '#27500A'
  const feedbackBorder = dark ? '#3D9B78' : '#639922'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/p/${personId}/feedback?sessionId=${sessionId}`)
      const d = await r.json()
      setFeedback(d.feedback ?? '—')
    } catch { setFeedback('Feedback konnte nicht geladen werden.') }
    finally { setLoading(false) }
  }, [sessionId, personId])

  const dividerStyle: React.CSSProperties = {
    borderTop: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #EDE8E0',
    margin: 0,
  }

  if (feedback) return (
    <>
      <div style={dividerStyle} />
      <div style={{ padding: '0.6rem 1rem' }}>
        <div style={{ fontSize: '0.7rem', fontFamily: MONO, color: feedbackBorder, letterSpacing: '0.06em', marginBottom: 5 }}>
          {dark ? 'COACH' : '💬 Coach'}
        </div>
        <div style={{
          fontSize: dark ? '0.78rem' : '0.82rem',
          fontFamily: dark ? MONO : 'inherit',
          color: feedbackText,
          lineHeight: 1.6,
          paddingLeft: 8,
          borderLeft: `2px solid ${feedbackBorder}`,
          background: feedbackBg,
          padding: '8px 10px',
          borderRadius: dark ? '0 6px 6px 0' : 6,
        }}>
          {feedback}
        </div>
      </div>
    </>
  )

  return (
    <>
      <div style={dividerStyle} />
      <button
        onClick={load}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '0.55rem 1rem',
          background: 'transparent', border: 'none', cursor: loading ? 'default' : 'pointer',
          color: loading ? (dark ? '#3D5265' : '#B0A898') : accentCol,
        }}
      >
        <span style={{ fontSize: dark ? '0.65rem' : '0.8rem', fontFamily: dark ? MONO : 'inherit', letterSpacing: dark ? '0.08em' : 0 }}>
          {loading ? (dark ? 'ANALYSIERE ···' : 'Feedback lädt…') : (dark ? '↯  COACH-FEEDBACK' : '💬  Coach-Feedback')}
        </span>
        {!loading && <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>→</span>}
      </button>
    </>
  )
}

export default function DonePage() {
  const { personId } = useParams<{ personId: string }>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const dark = personId !== 'p1'

  useEffect(() => {
    fetch(`/api/p/${personId}/plan?mode=done`)
      .then(r => r.json())
      .then(d => {
        setSessions((d.sessions ?? []).filter((s: Session) => s.completed_at || s.garmin_done))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [personId])

  const SPORT = dark ? SPORT_DARK : SPORT_LIGHT

  if (loading) return (
    <div style={{ textAlign: 'center', marginTop: '4rem', color: dark ? '#3D5265' : '#7A6E5E' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
      <p style={{ fontFamily: dark ? MONO : 'inherit', fontSize: dark ? '0.7rem' : '1rem' }}>Lädt…</p>
    </div>
  )

  const totalMin = sessions.reduce((s, x) => s + x.duration_min, 0)
  const sportCounts: Record<string, number> = {}
  for (const s of sessions) sportCounts[s.sport] = (sportCounts[s.sport] ?? 0) + 1

  return (
    <div>
      {/* TP-Aktivitätenlog nur für p2+ */}
      {dark && <MarkusActivities personId={personId} />}

      {/* Stats */}
      {sessions.length > 0 && (
        <>
          {dark && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#3D5265', letterSpacing: '0.15em', marginBottom: 10 }}>
              PLAN-EINHEITEN ERLEDIGT
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <div style={{
              background: dark ? '#111E30' : '#FDFCF9', borderRadius: dark ? 8 : 12,
              padding: '0.9rem 0.8rem', textAlign: 'center',
              border: dark ? '1px solid rgba(196,151,58,0.2)' : '1.5px solid #E8E0D4',
            }}>
              <div style={{ fontSize: '1.8rem', fontWeight: dark ? 400 : 800, fontFamily: dark ? MONO : 'inherit', color: dark ? '#C4973A' : '#2D7A5F' }}>{sessions.length}</div>
              <div style={{ fontSize: '0.65rem', color: dark ? '#3D5265' : '#7A6E5E', fontFamily: dark ? MONO : 'inherit', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Einheiten</div>
            </div>
            <div style={{
              background: dark ? '#111E30' : '#FDFCF9', borderRadius: dark ? 8 : 12,
              padding: '0.9rem 0.8rem', textAlign: 'center',
              border: dark ? '1px solid rgba(196,151,58,0.2)' : '1.5px solid #E8E0D4',
            }}>
              <div style={{ fontSize: '1.8rem', fontWeight: dark ? 400 : 800, fontFamily: dark ? MONO : 'inherit', color: dark ? '#C4973A' : '#2D7A5F' }}>{Math.round(totalMin / 60 * 10) / 10}h</div>
              <div style={{ fontSize: '0.65rem', color: dark ? '#3D5265' : '#7A6E5E', fontFamily: dark ? MONO : 'inherit', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gesamt</div>
            </div>
            {Object.entries(sportCounts).map(([sport, count]) => {
              const st = SPORT[sport]
              if (!st) return null
              return (
                <div key={sport} style={{ background: st.bg, borderRadius: dark ? 8 : 12, padding: '0.9rem 0.8rem', textAlign: 'center', border: `1px solid ${st.border}33` }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: dark ? 400 : 800, fontFamily: dark ? MONO : 'inherit', color: st.text }}>{count}</div>
                  <div style={{ fontSize: '0.65rem', color: st.text, fontFamily: dark ? MONO : 'inherit', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{st.statLabel}</div>
                </div>
              )
            })}
          </div>

          {/* Liste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {sessions.map(s => {
              const st = SPORT[s.sport] ?? (dark
                ? { bg: 'rgba(61,82,101,0.15)', border: '#3D5265', text: '#7A8FA5', icon: '🏅', label: s.sport }
                : { bg: '#F5F0E8', border: '#C4BAA8', text: '#7A6E5E', icon: '🏅', label: s.sport })
              const d = new Date(s.date + 'T12:00:00')
              const tagStr = `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`
              return (
                <div key={s.id} style={{
                  background: dark ? '#111E30' : '#FDFCF9',
                  borderRadius: dark ? '0 8px 8px 0' : 12,
                  border: dark ? `1px solid rgba(255,255,255,0.05)` : '1.5px solid #E8E0D4',
                  borderLeft: `${dark ? 3 : 6}px solid ${st.border}`,
                  overflow: 'hidden',
                }}>
                  {/* Hauptzeile */}
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{st.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: dark ? '0.9rem' : '0.92rem',
                        fontFamily: dark ? SERIF : 'inherit',
                        fontWeight: dark ? 400 : 700,
                        color: dark ? '#D8CFC0' : '#2A3828',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{s.title}</div>
                      <div style={{ fontSize: '0.72rem', color: dark ? '#3D5265' : '#9A8E7E', fontFamily: dark ? MONO : 'inherit', marginTop: 2, letterSpacing: dark ? '0.04em' : 0 }}>
                        {tagStr} · {s.actual_min ?? s.duration_min} min
                        {s.actual_hr ? ` · Ø ${s.actual_hr} bpm` : (s.hf_zone ? ` · ${s.hf_zone}` : '')}
                      </div>
                    </div>
                    <span style={{ fontSize: dark ? '0.65rem' : '1.2rem', color: dark ? '#3D9B78' : undefined, fontFamily: dark ? MONO : 'inherit', flexShrink: 0 }}>
                      {dark ? '✓' : (s.garmin_done ? '📡' : '✅')}
                    </span>
                  </div>
                  {/* Feedback-Strip — volle Breite, klar sichtbar */}
                  <FeedbackStrip sessionId={s.id} personId={personId} dark={dark} borderColor={st.border} />
                </div>
              )
            })}
          </div>
        </>
      )}

      {sessions.length === 0 && !dark && (
        <div style={{ textAlign: 'center', marginTop: '5rem', color: '#9A8E7E' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏁</div>
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>Noch keine erledigten Einheiten.</p>
          <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Hier erscheinen deine Trainings sobald du sie abhakst.</p>
        </div>
      )}
    </div>
  )
}

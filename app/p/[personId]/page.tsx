'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const SPORT_STYLE: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  running:  { bg: '#dcfce7', text: '#16a34a', icon: '🏃', label: 'Laufen' },
  cycling:  { bg: '#fef9c3', text: '#ca8a04', icon: '🚴', label: 'Rolle' },
  swimming: { bg: '#dbeafe', text: '#2563eb', icon: '🏊', label: 'Schwimmen' },
}
const OPT_STYLE = { bg: '#f1f5f9', text: '#64748b', icon: '➕', label: 'Optional' }

function sportStyle(sport: string, optional: boolean) {
  return optional ? OPT_STYLE : (SPORT_STYLE[sport] ?? { bg: '#f1f5f9', text: '#475569', icon: '🏅', label: sport })
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
}

function weekKey(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return mon.toISOString().split('T')[0]
}

function weekLabel(wk: string) {
  const d = new Date(wk + 'T12:00:00')
  const end = new Date(d); end.setDate(d.getDate() + 6)
  return `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`
}

type Session = {
  id: string; date: string; sport: string; title: string; duration_min: number
  hf_zone: string; hf_range: string | null; details: string | null
  is_optional: boolean; completed_at: string | null; garmin_done: boolean
  intensity_kind: string
}

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

  if (loading) return <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '3rem' }}>Lädt…</p>
  if (!sessions.length) return <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '3rem' }}>Keine Einheiten geplant.</p>

  const weeks: Record<string, Session[]> = {}
  for (const s of sessions) { const wk = weekKey(s.date); if (!weeks[wk]) weeks[wk] = []; weeks[wk].push(s) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {Object.entries(weeks).slice(0, 8).map(([wk, wkSessions]) => (
        <section key={wk}>
          <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
            {weekLabel(wk)}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {wkSessions.map(s => {
              const st = sportStyle(s.sport, s.is_optional)
              const done = !!s.completed_at || s.garmin_done
              const isOpen = expanded === s.id
              return (
                <div key={s.id} style={{
                  background: done ? '#f8fafc' : '#fff', borderRadius: 12,
                  border: `1.5px solid ${isOpen && !done ? st.text : '#e2e8f0'}`,
                  opacity: done ? 0.65 : 1,
                }}>
                  <button onClick={() => setExpanded(isOpen ? null : s.id)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ background: st.bg, color: st.text, borderRadius: 7, padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {st.icon} {st.label}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 600, color: done ? '#94a3b8' : '#1a2332', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{s.duration_min}&thinsp;min</span>
                    {done && <span>✅</span>}
                    <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #f1f5f9' }}>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.5rem 0 0.3rem' }}>{fmtDate(s.date)}</p>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.4rem 0' }}>
                        {s.hf_zone && (
                          <span style={{ background: '#f1f5f9', borderRadius: 6, padding: '3px 8px', fontSize: '0.78rem', color: '#475569' }}>
                            HF {s.hf_zone}{s.hf_range ? ` · ${s.hf_range}` : ''}
                          </span>
                        )}
                        {s.intensity_kind === 'interval' && (
                          <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '3px 8px', fontSize: '0.78rem', fontWeight: 600 }}>⚡ Intervall</span>
                        )}
                        {s.intensity_kind === 'technique' && (
                          <span style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: 6, padding: '3px 8px', fontSize: '0.78rem' }}>🎯 Technik</span>
                        )}
                        {s.is_optional && (
                          <span style={{ background: '#f1f5f9', color: '#94a3b8', borderRadius: 6, padding: '3px 8px', fontSize: '0.78rem' }}>optional</span>
                        )}
                      </div>
                      {s.details && (
                        <p style={{ fontSize: '0.83rem', color: '#475569', lineHeight: 1.65, margin: '0.5rem 0 0.8rem', background: '#f8fafc', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
                          {s.details}
                        </p>
                      )}
                      {s.garmin_done && !s.completed_at && (
                        <p style={{ fontSize: '0.78rem', color: '#16a34a', margin: '0 0 0.5rem' }}>✅ Garmin hat heute eine passende Aktivität erkannt</p>
                      )}
                      {!s.garmin_done && (
                        <button onClick={() => toggleDone(s)} disabled={marking === s.id} style={{
                          width: '100%', padding: '0.65rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                          fontWeight: 600, fontSize: '0.88rem',
                          background: s.completed_at ? '#f1f5f9' : '#2563eb',
                          color: s.completed_at ? '#64748b' : '#fff',
                          opacity: marking === s.id ? 0.6 : 1,
                        }}>
                          {marking === s.id ? '…' : s.completed_at ? '✓ Erledigt — rückgängig machen?' : '✓ Als erledigt markieren'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

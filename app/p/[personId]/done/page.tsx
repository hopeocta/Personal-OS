'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const SPORT: Record<string, { bg: string; border: string; text: string; icon: string; label: string; statLabel: string }> = {
  running:  { bg: '#E8F7EE', border: '#4CAF82', text: '#1A5C3A', icon: '🏃', label: 'Laufen',     statLabel: 'Läufe' },
  cycling:  { bg: '#FEF5E4', border: '#E8A44A', text: '#7A4A10', icon: '🚴', label: 'Rolle',      statLabel: 'Rolle' },
  swimming: { bg: '#E4F2FB', border: '#5B9FD4', text: '#1A4A6E', icon: '🏊', label: 'Schwimmen', statLabel: 'Schwimmen' },
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

type Session = {
  id: string; date: string; sport: string; title: string; duration_min: number
  hf_zone: string; completed_at: string | null; garmin_done: boolean; is_optional: boolean
}

export default function DonePage() {
  const { personId } = useParams<{ personId: string }>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/p/${personId}/plan?mode=done`)
      .then(r => r.json())
      .then(d => {
        setSessions((d.sessions ?? []).filter((s: Session) => s.completed_at || s.garmin_done))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [personId])

  if (loading) return (
    <div style={{ textAlign: 'center', marginTop: '4rem', color: '#7A6E5E' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
      <p>Lädt…</p>
    </div>
  )

  if (!sessions.length) return (
    <div style={{ textAlign: 'center', marginTop: '5rem', color: '#9A8E7E' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏁</div>
      <p style={{ fontSize: '1rem', fontWeight: 600 }}>Noch keine erledigten Einheiten.</p>
      <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Hier erscheinen deine Trainings sobald du sie abhakst.</p>
    </div>
  )

  const totalMin = sessions.reduce((s, x) => s + x.duration_min, 0)
  const sportCounts: Record<string, number> = {}
  for (const s of sessions) sportCounts[s.sport] = (sportCounts[s.sport] ?? 0) + 1

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#FDFCF9', borderRadius: 12, padding: '0.9rem 0.8rem', textAlign: 'center', border: '1.5px solid #E8E0D4' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2D7A5F' }}>{sessions.length}</div>
          <div style={{ fontSize: '0.72rem', color: '#7A6E5E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Einheiten</div>
        </div>
        <div style={{ background: '#FDFCF9', borderRadius: 12, padding: '0.9rem 0.8rem', textAlign: 'center', border: '1.5px solid #E8E0D4' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2D7A5F' }}>{Math.round(totalMin / 60 * 10) / 10}h</div>
          <div style={{ fontSize: '0.72rem', color: '#7A6E5E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gesamt</div>
        </div>
        {Object.entries(sportCounts).map(([sport, count]) => {
          const st = SPORT[sport]
          if (!st) return null
          return (
            <div key={sport} style={{ background: st.bg, borderRadius: 12, padding: '0.9rem 0.8rem', textAlign: 'center', border: `1.5px solid ${st.border}` }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: st.text }}>{count}</div>
              <div style={{ fontSize: '0.72rem', color: st.text, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.icon} {st.statLabel}</div>
            </div>
          )
        })}
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {sessions.map(s => {
          const st = SPORT[s.sport] ?? { bg: '#F5F0E8', border: '#C4BAA8', text: '#7A6E5E', icon: '🏅', label: s.sport }
          const d = new Date(s.date + 'T12:00:00')
          const tagStr = `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`
          return (
            <div key={s.id} style={{
              background: '#FDFCF9', borderRadius: 12,
              border: '1.5px solid #E8E0D4',
              display: 'flex', alignItems: 'stretch', overflow: 'hidden',
            }}>
              {/* Farbstreifen */}
              <div style={{ width: 6, background: st.border, flexShrink: 0 }} />
              <div style={{ flex: 1, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{st.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2A3828', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#9A8E7E', marginTop: 2 }}>{tagStr} · {s.duration_min} min · {s.hf_zone}</div>
                </div>
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }} title={s.garmin_done ? 'Garmin erkannt' : 'Manuell'}>{s.garmin_done ? '📡' : '✅'}</span>
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: '0.72rem', color: '#C4BAA8', textAlign: 'center', marginTop: '1.2rem' }}>
        📡 Garmin erkannt · ✅ Manuell markiert
      </p>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const SPORT_STYLE: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  running:  { bg: '#dcfce7', text: '#16a34a', icon: '🏃', label: 'Läufe' },
  cycling:  { bg: '#fef9c3', text: '#ca8a04', icon: '🚴', label: 'Rolle' },
  swimming: { bg: '#dbeafe', text: '#2563eb', icon: '🏊', label: 'Schwimmen' },
}

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

  if (loading) return <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '3rem' }}>Lädt…</p>
  if (!sessions.length) return (
    <div style={{ textAlign: 'center', marginTop: '4rem', color: '#94a3b8' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🏁</div>
      <p>Noch keine erledigten Einheiten.</p>
    </div>
  )

  const totalMin = sessions.reduce((s, x) => s + x.duration_min, 0)
  const sportCounts: Record<string, number> = {}
  for (const s of sessions) sportCounts[s.sport] = (sportCounts[s.sport] ?? 0) + 1

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '0.6rem 1rem', flex: 1, minWidth: 80, textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a2332' }}>{sessions.length}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Einheiten</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '0.6rem 1rem', flex: 1, minWidth: 80, textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a2332' }}>{Math.round(totalMin / 60 * 10) / 10}h</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Gesamtzeit</div>
        </div>
        {Object.entries(sportCounts).map(([sport, count]) => {
          const st = SPORT_STYLE[sport] ?? { bg: '#f1f5f9', text: '#475569', icon: '🏅', label: sport }
          return (
            <div key={sport} style={{ background: st.bg, borderRadius: 10, padding: '0.6rem 1rem', flex: 1, minWidth: 70, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: st.text }}>{count}</div>
              <div style={{ fontSize: '0.72rem', color: st.text }}>{st.icon} {st.label}</div>
            </div>
          )
        })}
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {sessions.map(s => {
          const st = SPORT_STYLE[s.sport] ?? { bg: '#f1f5f9', text: '#475569', icon: '🏅', label: s.sport }
          const dateStr = new Date(s.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
          return (
            <div key={s.id} style={{ background: '#fff', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.7rem', border: '1px solid #e2e8f0' }}>
              <span style={{ background: st.bg, color: st.text, borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem', fontWeight: 700 }}>{st.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1a2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{dateStr} · {s.duration_min} min · {s.hf_zone}</div>
              </div>
              <span title={s.garmin_done ? 'Garmin erkannt' : 'Manuell markiert'}>{s.garmin_done ? '📡' : '✅'}</span>
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: '0.72rem', color: '#cbd5e1', textAlign: 'center', marginTop: '1rem' }}>📡 Garmin erkannt · ✅ Manuell</p>
    </div>
  )
}

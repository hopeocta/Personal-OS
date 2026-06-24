'use client'
import { useRef, useState } from 'react'

type ChatMsg = { role: 'user' | 'assistant'; content: string }
type MoveAction = { type: 'move'; sessionId: string; sessionTitle: string; fromDate: string; toDate: string }
type Action = MoveAction | { type: 'sick' } | null

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
function fmtDate(str: string) {
  const d = new Date(str + 'T12:00:00')
  return `${WOCHENTAGE[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`
}

const LIGHT = {
  fab:       '#2D7A5F',
  overlay:   '#FDFCF9',
  border:    '1.5px solid #E8E0D4',
  backCol:   '#7A6E5E',
  title:     '#2A3828',
  sub:       '#9A8E7E',
  userBg:    '#2D7A5F',
  userCol:   '#fff',
  botBg:     '#F0EBE3',
  botCol:    '#2A3828',
  emptyCol:  '#9A8E7E',
  inputBg:   '#FFFDF8',
  inputCol:  '#2A3828',
  inputBor:  '1.5px solid #D4C9B8',
  sendBg:    '#2D7A5F',
  sendCol:   '#fff',
  clearCol:  '#B8AE9E',
  actionBg:  '#FEF5E4',
  actionBor: '1.5px solid #E8A44A',
  actionCol: '#7A4A10',
  cancelBg:  '#F5F0E8',
  cancelCol: '#7A6E5E',
  cancelBor: '1.5px solid #D4C9B8',
}
const DARK = {
  fab:       '#C4973A',
  overlay:   '#0B1520',
  border:    '1px solid rgba(196,151,58,0.2)',
  backCol:   '#7A8FA5',
  title:     '#D8CFC0',
  sub:       '#3D5265',
  userBg:    '#C4973A',
  userCol:   '#0B1520',
  botBg:     '#111E30',
  botCol:    '#D8CFC0',
  emptyCol:  '#3D5265',
  inputBg:   '#111E30',
  inputCol:  '#D8CFC0',
  inputBor:  '1px solid rgba(196,151,58,0.3)',
  sendBg:    '#C4973A',
  sendCol:   '#0B1520',
  clearCol:  '#3D5265',
  actionBg:  'rgba(196,151,58,0.1)',
  actionBor: '1px solid rgba(196,151,58,0.4)',
  actionCol: '#C4973A',
  cancelBg:  'rgba(255,255,255,0.04)',
  cancelCol: '#7A8FA5',
  cancelBor: '1px solid rgba(255,255,255,0.1)',
}

export default function UteChat({ personId, onPlanChanged, dark = false }: {
  personId: string
  onPlanChanged: () => void
  dark?: boolean
}) {
  const T = dark ? DARK : LIGHT
  const [open, setOpen]               = useState(false)
  const [messages, setMessages]       = useState<ChatMsg[]>([])
  const [input, setInput]             = useState('')
  const [busy, setBusy]               = useState(false)
  const [pendingAction, setPendingAction] = useState<Action>(null)
  const [confirming, setConfirming]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput(''); setPendingAction(null)
    const userMsg: ChatMsg = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages([...next, { role: 'assistant', content: '…' }])
    setBusy(true)
    try {
      const res = await fetch(`/api/p/${personId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { answer: string; action: Action }
      setMessages([...next, { role: 'assistant', content: data.answer }])
      if (data.action) setPendingAction(data.action)
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Fehler: ${e instanceof Error ? e.message : 'unbekannt'}` }])
    } finally {
      setBusy(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  async function confirmMove(a: MoveAction) {
    setConfirming(true)
    try {
      const res = await fetch(`/api/p/${personId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: a.sessionId, date: a.toDate }),
      })
      if (!res.ok) throw new Error()
      setPendingAction(null)
      setMessages(prev => [...prev, { role: 'assistant', content: `✅ "${a.sessionTitle}" wurde auf ${fmtDate(a.toDate)} verschoben.` }])
      onPlanChanged()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Verschieben fehlgeschlagen.' }])
    } finally { setConfirming(false) }
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Chat öffnen"
        style={{
          position: 'fixed', bottom: 84, right: 20,
          width: 52, height: 52, borderRadius: '50%',
          background: T.fab, color: T.sendCol,
          border: 'none', cursor: 'pointer',
          display: open ? 'none' : 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', zIndex: 50,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}
      >💬</button>

      {/* Overlay */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', flexDirection: 'column',
          background: T.overlay,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px 12px',
            borderBottom: T.border,
            background: T.overlay, flexShrink: 0,
          }}>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: T.backCol, padding: '0 4px' }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: T.title }}>Trainings-Chat</div>
              <div style={{ fontSize: '0.68rem', color: T.sub, letterSpacing: '0.05em' }}>OWL ALPHA · GRATIS</div>
            </div>
            <button onClick={() => { setMessages([]); setPendingAction(null) }} style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: T.clearCol, cursor: 'pointer' }}>
              Leeren
            </button>
          </div>

          {/* Nachrichten */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: T.emptyCol, padding: '3rem 1rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🏊</div>
                <div style={{ fontSize: '0.88rem', color: T.title }}>Stell eine Frage zu deinem Training.</div>
                <div style={{ fontSize: '0.78rem', marginTop: 6, color: T.emptyCol, lineHeight: 1.5 }}>
                  „Was ist meine Z2-Pace?" · „Verschiebe das Schwimmen auf Dienstag" · „Wie lange sollte ich heute laufen?"
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: m.role === 'user' ? T.userBg : T.botBg,
                color: m.role === 'user' ? T.userCol : T.botCol,
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '9px 13px', fontSize: '0.88rem', lineHeight: 1.5,
              }}>{m.content}</div>
            ))}

            {pendingAction && pendingAction.type === 'move' && (
              <div style={{ background: T.actionBg, border: T.actionBor, borderRadius: 12, padding: '12px 14px', fontSize: '0.85rem', color: T.actionCol }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>📅 Einheit verschieben</div>
                <div style={{ marginBottom: 12 }}>
                  <strong>{pendingAction.sessionTitle}</strong><br />
                  {fmtDate(pendingAction.fromDate)} → {fmtDate(pendingAction.toDate)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => confirmMove(pendingAction as MoveAction)} disabled={confirming} style={{ flex: 1, background: T.sendBg, color: T.sendCol, border: 'none', borderRadius: 8, padding: '0.55rem', fontWeight: 700, fontSize: '0.85rem', cursor: confirming ? 'wait' : 'pointer', opacity: confirming ? 0.6 : 1 }}>
                    {confirming ? '…' : '✓ Bestätigen'}
                  </button>
                  <button onClick={() => setPendingAction(null)} disabled={confirming} style={{ flex: 1, background: T.cancelBg, color: T.cancelCol, border: T.cancelBor, borderRadius: 8, padding: '0.55rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Eingabe */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: T.border, background: T.overlay, flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void send() }}
              placeholder="Frage stellen oder Änderung wünschen…"
              disabled={busy}
              style={{ flex: 1, border: T.inputBor, borderRadius: 22, padding: '10px 14px', fontSize: '0.88rem', background: T.inputBg, color: T.inputCol, outline: 'none' }}
            />
            <button onClick={() => void send()} disabled={!input.trim() || busy} style={{ width: 42, height: 42, borderRadius: '50%', background: T.sendBg, border: 'none', color: T.sendCol, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: !input.trim() || busy ? 'not-allowed' : 'pointer', opacity: !input.trim() || busy ? 0.5 : 1, flexShrink: 0 }}>
              {busy ? <span style={{ fontSize: '0.75rem' }}>…</span> : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { TopRail } from '@/components/dashboard/TopRail'
import { localDateKey } from '@/lib/dateUtils'
import { DENTAL_SKILLS } from '@/lib/config/dentalSkills'
import type { DailyHabit, CalendarEvent, KnowledgeEntry } from '@/lib/types'

const ZM_SUBJECTS = [
  'ZM_Anatomie',
  'ZM_Physiologie',
  'ZM_Zahnerhaltung',
  'ZM_Prothetik',
  'ZM_Kieferorthopädie',
  'ZM_Parodontologie',
  'ZM_Oralchirurgie',
  'ZM_Radiologie',
]

const EXAM_KEYWORDS = ['Prüfung', 'Klausur', 'OSCE', 'Testat', 'Exam']

const CAT_COLOR = 'var(--accent)'

function subjectLabel(name: string) {
  return name.replace('ZM_', '')
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function last30Days(today: string): string[] {
  return Array.from({ length: 30 }, (_, i) => offsetDate(today, i - 29))
}

function calcStreak(records: DailyHabit[], habitName: string, today: string): number {
  const done = new Set(
    records.filter(r => r.habit_name === habitName && r.completed).map(r => r.date)
  )
  let streak = 0
  let cursor = today
  while (done.has(cursor)) {
    streak++
    cursor = offsetDate(cursor, -1)
  }
  return streak
}

function daysUntil(isoStart: string, today: string): number {
  const exam = new Date(isoStart.slice(0, 10) + 'T00:00:00')
  const now = new Date(today + 'T00:00:00')
  return Math.ceil((exam.getTime() - now.getTime()) / 86400000)
}

function examColor(days: number): string {
  if (days < 0) return 'var(--ink-3)'
  if (days < 7) return 'var(--danger)'
  if (days <= 30) return 'var(--warn)'
  return 'var(--ok)'
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: '12px',
  padding: '1.25rem',
  backdropFilter: 'blur(8px)',
}

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.7rem',
  letterSpacing: '0.12em',
  color: 'var(--ink-3)',
  marginBottom: '1rem',
}

export default function ZahnmedizinPage() {
  const today = localDateKey()

  // Study progress state
  const [studyRecords, setStudyRecords] = useState<DailyHabit[]>([])
  const [studyLoading, setStudyLoading] = useState(true)

  // Clinical skills state (localStorage)
  const [completedSkills, setCompletedSkills] = useState<Set<string>>(new Set())
  const [skillsReady, setSkillsReady] = useState(false)

  // Exams state
  const [examEvents, setExamEvents] = useState<CalendarEvent[]>([])
  const [examsLoading, setExamsLoading] = useState(true)
  const [expandedExam, setExpandedExam] = useState<string | null>(null)

  // Research state
  const [researchEntries, setResearchEntries] = useState<KnowledgeEntry[]>([])
  const [researchLoading, setResearchLoading] = useState(true)
  const [researchSearch, setResearchSearch] = useState('')
  const [captureText, setCaptureText] = useState('')
  const [captureSaving, setCaptureSaving] = useState(false)
  const [captureToast, setCaptureToast] = useState<string | null>(null)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load study records (last 30 days, ZM_ habits)
  const loadStudyData = useCallback(async () => {
    setStudyLoading(true)
    const from = offsetDate(today, -29)
    try {
      const res = await fetch(`/api/habits?from=${from}&to=${today}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStudyRecords((data as DailyHabit[]).filter(r => r.habit_name.startsWith('ZM_')))
    } catch (err) {
      console.error('[zahnmedizin] study load error:', err)
    } finally {
      setStudyLoading(false)
    }
  }, [today])

  // Load clinical skills from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zm_skills_completed')
      if (raw) setCompletedSkills(new Set(JSON.parse(raw) as string[]))
    } catch {
      // ignore parse errors
    }
    setSkillsReady(true)
  }, [])

  // Load exam events (90-day window)
  const loadExams = useCallback(async () => {
    setExamsLoading(true)
    try {
      const res = await fetch('/api/calendar?days=90')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'calendar error')
      const filtered = (data as CalendarEvent[]).filter(ev =>
        EXAM_KEYWORDS.some(kw => ev.title.toLowerCase().includes(kw.toLowerCase()))
      )
      setExamEvents(filtered)
    } catch (err) {
      console.error('[zahnmedizin] exam load error:', err)
    } finally {
      setExamsLoading(false)
    }
  }, [])

  // Load Zahnmedizin research entries
  const loadResearch = useCallback(async () => {
    setResearchLoading(true)
    try {
      const res = await fetch('/api/knowledge?category=Zahnmedizin&limit=100')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResearchEntries(data)
    } catch (err) {
      console.error('[zahnmedizin] research load error:', err)
    } finally {
      setResearchLoading(false)
    }
  }, [])

  useEffect(() => { loadStudyData() }, [loadStudyData])
  useEffect(() => { loadExams() }, [loadExams])
  useEffect(() => { loadResearch() }, [loadResearch])

  // Toggle study habit for today
  const toggleStudy = async (habitName: string) => {
    const existing = studyRecords.find(r => r.date === today && r.habit_name === habitName)
    const newCompleted = !(existing?.completed ?? false)

    // Optimistic update
    setStudyRecords(prev => {
      const filtered = prev.filter(r => !(r.date === today && r.habit_name === habitName))
      return [...filtered, {
        id: existing?.id ?? `tmp-${habitName}`,
        user_id: 'me',
        date: today,
        habit_name: habitName,
        completed: newCompleted,
        created_at: new Date().toISOString(),
      }]
    })

    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, habit_name: habitName, completed: newCompleted }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
    } catch (err) {
      console.error('[zahnmedizin] toggle error:', err)
      // Revert optimistic update
      setStudyRecords(prev => {
        const filtered = prev.filter(r => !(r.date === today && r.habit_name === habitName))
        if (existing) return [...filtered, existing]
        return filtered
      })
    }
  }

  // Toggle clinical skill in localStorage
  const toggleSkill = (id: string) => {
    setCompletedSkills(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      try { localStorage.setItem('zm_skills_completed', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  // Save research entry (category pre-set to Zahnmedizin)
  const handleCaptureSave = async () => {
    if (!captureText.trim() || captureSaving) return
    setCaptureSaving(true)
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: captureText.trim(), source: 'zahnmedizin' }),
      })
      const entry: KnowledgeEntry = await res.json()
      if (!res.ok) throw new Error((entry as { error?: string }).error)
      setCaptureText('')
      setResearchEntries(prev => [entry, ...prev])
      if (toastTimer.current) clearTimeout(toastTimer.current)
      setCaptureToast(entry.summary ?? 'Gespeichert')
      toastTimer.current = setTimeout(() => setCaptureToast(null), 4000)
    } catch (err) {
      console.error('[zahnmedizin] capture error:', err)
    } finally {
      setCaptureSaving(false)
    }
  }

  const toggleEntry = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const days30 = last30Days(today)

  const filteredResearch = researchEntries.filter(e => {
    if (!researchSearch) return true
    const q = researchSearch.toLowerCase()
    return (
      e.raw_text.toLowerCase().includes(q) ||
      (e.summary ?? '').toLowerCase().includes(q) ||
      (e.tags ?? []).some(t => t.toLowerCase().includes(q))
    )
  })

  const vorklinikSkills = DENTAL_SKILLS.filter(s => s.level === 'Vorklinik')
  const klinikSkills = DENTAL_SKILLS.filter(s => s.level === 'Klinik')
  const vorklinikDone = vorklinikSkills.filter(s => completedSkills.has(s.id)).length
  const klinikDone = klinikSkills.filter(s => completedSkills.has(s.id)).length

  return (
    <>
      <TopRail />

      {/* Toast */}
      {captureToast && (
        <div style={{
          position: 'fixed', top: '4.5rem', right: '1.5rem', zIndex: 50,
          background: 'var(--card)',
          border: `1px solid var(--line-strong)`,
          borderLeft: `3px solid ${CAT_COLOR}`,
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.8rem',
          color: 'var(--ink-1)',
          boxShadow: '0 4px 24px rgba(80,60,40,0.25)',
          maxWidth: '320px',
        }}>
          <div style={{ color: CAT_COLOR, fontWeight: 600 }}>✓ Zahnmedizin gespeichert</div>
          <div style={{ color: 'var(--ink-2)', marginTop: '0.2rem' }}>{captureToast}</div>
        </div>
      )}

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Section 1: Lernfortschritt ── */}
        <div style={CARD}>
          <div style={SECTION_TITLE}>LERNFORTSCHRITT — HEUTE</div>

          {studyLoading ? (
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)' }}>LADEN...</div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '0.75rem',
            }}>
              {ZM_SUBJECTS.map(habit => {
                const todayRecord = studyRecords.find(r => r.date === today && r.habit_name === habit)
                const studiedToday = todayRecord?.completed ?? false
                const streak = calcStreak(studyRecords, habit, today)

                return (
                  <div
                    key={habit}
                    style={{
                      background: studiedToday
                        ? '#F6ECE4'
                        : 'var(--card)',
                      border: `1px solid ${studiedToday ? CAT_COLOR : 'var(--line)'}`,
                      borderRadius: '10px',
                      padding: '0.875rem',
                    }}
                  >
                    {/* Subject name + toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                      <span style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.82rem',
                        color: studiedToday ? 'var(--ink-0)' : 'var(--ink-1)',
                        fontWeight: studiedToday ? 600 : 400,
                      }}>
                        {subjectLabel(habit)}
                      </span>
                      <button
                        onClick={() => toggleStudy(habit)}
                        style={{
                          background: studiedToday ? CAT_COLOR : 'var(--line)',
                          border: `1px solid ${studiedToday ? CAT_COLOR : 'var(--line-strong)'}`,
                          borderRadius: '6px',
                          width: '28px',
                          height: '28px',
                          cursor: 'pointer',
                          color: studiedToday ? 'var(--paper)' : 'var(--ink-3)',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {studiedToday ? '✓' : '○'}
                      </button>
                    </div>

                    {/* Streak */}
                    <div style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.68rem',
                      color: streak > 0 ? 'var(--warn)' : 'var(--ink-3)',
                      marginBottom: '0.5rem',
                    }}>
                      {streak > 0 ? `🔥 ${streak} Tage` : 'Noch kein Streak'}
                    </div>

                    {/* Mini heatmap: last 30 days */}
                    <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                      {days30.map(day => {
                        const rec = studyRecords.find(r => r.date === day && r.habit_name === habit)
                        const done = rec?.completed ?? false
                        return (
                          <div
                            key={day}
                            title={day}
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '1px',
                              background: done ? CAT_COLOR : 'var(--line)',
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Section 2: Klinische Skills ── */}
        <div style={CARD}>
          <div style={SECTION_TITLE}>KLINISCHE SKILLS</div>

          {!skillsReady ? (
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)' }}>LADEN...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {(['Vorklinik', 'Klinik'] as const).map(level => {
                const skills = level === 'Vorklinik' ? vorklinikSkills : klinikSkills
                const done = level === 'Vorklinik' ? vorklinikDone : klinikDone
                const pct = Math.round((done / skills.length) * 100)

                return (
                  <div key={level}>
                    {/* Level header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-2)', letterSpacing: '0.08em' }}>
                        {level.toUpperCase()}
                      </span>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: pct === 100 ? 'var(--ok)' : 'var(--ink-3)' }}>
                        {done}/{skills.length} — {pct}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: '3px', background: 'var(--line)', borderRadius: '2px', marginBottom: '0.75rem', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ok)', borderRadius: '2px', transition: 'width 0.3s' }} />
                    </div>

                    {/* Skills list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {skills.map(skill => {
                        const checked = completedSkills.has(skill.id)
                        return (
                          <label
                            key={skill.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.625rem',
                              cursor: 'pointer',
                              padding: '0.375rem 0.5rem',
                              borderRadius: '6px',
                              background: checked ? '#E6EDD6' : 'transparent',
                              transition: 'background 0.12s',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSkill(skill.id)}
                              style={{ accentColor: 'var(--ok)', width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0 }}
                            />
                            <span style={{
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '0.78rem',
                              color: checked ? 'var(--ink-2)' : 'var(--ink-1)',
                              textDecoration: checked ? 'line-through' : 'none',
                            }}>
                              {skill.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Section 3: Prüfungen ── */}
        <div style={CARD}>
          <div style={SECTION_TITLE}>PRÜFUNGEN (nächste 90 Tage)</div>

          {examsLoading ? (
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)' }}>LADEN...</div>
          ) : examEvents.length === 0 ? (
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)' }}>
              Keine Prüfungen im Kalender gefunden.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {examEvents.map(ev => {
                const days = daysUntil(ev.start, today)
                const color = examColor(days)
                const isOpen = expandedExam === ev.id

                return (
                  <div
                    key={ev.id}
                    onClick={() => setExpandedExam(isOpen ? null : ev.id)}
                    style={{
                      background: 'var(--card)',
                      border: `1px solid var(--line)`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: '8px',
                      padding: '0.875rem 1rem',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {/* Days badge */}
                      <div style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        color,
                        minWidth: '3rem',
                        textAlign: 'center',
                        lineHeight: 1,
                      }}>
                        {days < 0 ? 'vorbei' : days === 0 ? 'heute' : `${days}d`}
                      </div>

                      {/* Title + date */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem', color: 'var(--ink-0)', fontWeight: 600 }}>
                          {ev.title}
                        </div>
                        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-3)', marginTop: '0.2rem' }}>
                          {formatDate(ev.start)}{!ev.allDay ? ` — ${formatDateTime(ev.start)} Uhr` : ''}
                          {ev.location ? ` · ${ev.location}` : ''}
                        </div>
                      </div>

                      <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
                    </div>

                    {isOpen && ev.description && (
                      <div style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--line)',
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.78rem',
                        color: 'var(--ink-2)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {ev.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Section 4: Zahnmedizin Recherche ── */}
        <div style={CARD}>
          <div style={SECTION_TITLE}>RECHERCHE — ZAHNMEDIZIN</div>

          {/* Quick capture */}
          <div style={{ marginBottom: '1rem' }}>
            <textarea
              value={captureText}
              onChange={e => setCaptureText(e.target.value)}
              placeholder="Lernnotiz, Recherche, Erkenntnis..."
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCaptureSave() }}
              style={{
                width: '100%',
                minHeight: '80px',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '0.75rem',
                color: 'var(--ink-0)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.875rem',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-3)' }}>
                Wird als Zahnmedizin kategorisiert · Ctrl+Enter
              </span>
              <button
                onClick={handleCaptureSave}
                disabled={!captureText.trim() || captureSaving}
                style={{
                  background: captureSaving ? 'var(--line-strong)' : CAT_COLOR,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1.25rem',
                  color: captureSaving ? 'var(--ink-2)' : 'var(--paper)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  cursor: captureSaving || !captureText.trim() ? 'not-allowed' : 'pointer',
                  opacity: !captureText.trim() ? 0.4 : 1,
                }}
              >
                {captureSaving ? 'SPEICHERN...' : 'SPEICHERN'}
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-3)' }}>
              {researchLoading ? 'LADEN...' : `${filteredResearch.length} EINTRÄGE`}
            </span>
            <input
              type="text"
              value={researchSearch}
              onChange={e => setResearchSearch(e.target.value)}
              placeholder="Suchen..."
              style={{
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                color: 'var(--ink-0)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.78rem',
                outline: 'none',
                width: '180px',
              }}
            />
          </div>

          {/* Entry list */}
          {researchLoading ? (
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)', textAlign: 'center', padding: '2rem' }}>
              LADEN...
            </div>
          ) : filteredResearch.length === 0 ? (
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)', textAlign: 'center', padding: '2rem' }}>
              {researchSearch ? 'KEINE TREFFER' : 'NOCH KEINE EINTRÄGE'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredResearch.map(entry => {
                const isOpen = expandedEntries.has(entry.id)
                return (
                  <div
                    key={entry.id}
                    onClick={() => toggleEntry(entry.id)}
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--line)',
                      borderLeft: `3px solid ${CAT_COLOR}`,
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                      <span style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.82rem',
                        color: 'var(--ink-0)',
                        flex: 1,
                        lineHeight: 1.45,
                      }}>
                        {entry.summary ?? entry.raw_text.slice(0, 100)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.68rem', color: 'var(--ink-3)' }}>
                          {formatDate(entry.created_at)}
                        </span>
                        <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
                      </div>
                    </div>

                    {entry.tags && entry.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                        {entry.tags.map(tag => (
                          <span key={tag} style={{
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '0.62rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: 'var(--line)',
                            color: 'var(--ink-2)',
                            border: '1px solid var(--line)',
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {isOpen && (
                      <div style={{
                        marginTop: '0.625rem',
                        paddingTop: '0.625rem',
                        borderTop: '1px solid var(--line)',
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.78rem',
                        color: 'var(--ink-2)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {entry.raw_text}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { TopRail } from '@/components/dashboard/TopRail'
import type { MusicProject, SoundLibrary } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

type ProjectStatus = 'idea' | 'wip' | 'mixing' | 'done' | 'released'

const STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; color: string }> = {
  idea:     { label: 'IDEE',     bg: 'var(--line)',      color: 'var(--ink-3)' },
  wip:      { label: 'WIP',      bg: '#F3E0D5', color: 'var(--accent)' },
  mixing:   { label: 'MIXING',   bg: '#F5E8CC',  color: 'var(--warn)' },
  done:     { label: 'DONE',     bg: '#E6EDD6', color: 'var(--ok)' },
  released: { label: 'RELEASED', bg: '#EAE0EE', color: '#7E5A86' },
}

const STATUS_ORDER: ProjectStatus[] = ['idea', 'wip', 'mixing', 'done', 'released']

const SOUND_CATEGORIES = ['drums', 'bass', 'synth', 'vocals', 'fx', 'loop', 'oneshot', 'sample'] as const
type SoundCat = (typeof SOUND_CATEGORIES)[number] | 'alle'

const SCALES = ['minor', 'major', 'dorian', 'mixolydian', 'phrygian', 'lydian', 'harmonic minor']

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--line)',
  border: '1px solid var(--line-strong)',
  borderRadius: '6px',
  padding: '0.45rem 0.6rem',
  color: 'var(--ink-0)',
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.8rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.62rem',
  color: 'var(--ink-3)',
  letterSpacing: '0.06em',
  marginBottom: '0.3rem',
  display: 'block',
}

const btnPrimary: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  padding: '0.5rem 1rem',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  background: 'var(--accent)',
  color: 'var(--paper)',
}

const btnGhost: React.CSSProperties = {
  ...btnPrimary,
  background: 'var(--line)',
  color: 'var(--ink-1)',
}

const btnDanger: React.CSSProperties = {
  ...btnPrimary,
  background: '#F3D8D8',
  color: 'var(--danger)',
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      fontFamily: 'ui-monospace, monospace',
      fontSize: '0.6rem',
      letterSpacing: '0.05em',
      padding: '0.2rem 0.45rem',
      borderRadius: '4px',
      background: cfg.bg,
      color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'ui-monospace, monospace',
      fontSize: '0.6rem',
      padding: '0.15rem 0.4rem',
      borderRadius: '3px',
      background: '#EFE7D6',
      color: 'var(--ink-2)',
    }}>
      {children}
    </span>
  )
}

// ─── Draft types ──────────────────────────────────────────────────────────────

type EditDraft = {
  title: string
  bpm: string
  musical_key: string
  scale: string
  genre: string
  mood: string
  status: ProjectStatus
  collab: string
  notes: string
}

type QuickDraft = {
  title: string
  bpm: string
  musical_key: string
  scale: string
  genre: string
  mood: string
}

type SoundDraft = {
  name: string
  category: string
  tags: string
  bpm: string
  musical_key: string
  file_path: string
  notes: string
}

function emptyQuick(): QuickDraft {
  return { title: '', bpm: '', musical_key: '', scale: '', genre: '', mood: '' }
}

function emptySound(): SoundDraft {
  return { name: '', category: 'drums', tags: '', bpm: '', musical_key: '', file_path: '', notes: '' }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type View = 'projekte' | 'sounds'

export default function MusikPage() {
  const [view, setView] = useState<View>('projekte')

  // ── Projects ──
  const [projects, setProjects] = useState<MusicProject[]>([])
  const [projLoading, setProjLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'alle'>('alle')
  const [genreFilter, setGenreFilter] = useState('alle')
  const [editProject, setEditProject] = useState<MusicProject | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickDraft, setQuickDraft] = useState<QuickDraft>(emptyQuick())
  const [quickSaving, setQuickSaving] = useState(false)

  // ── Sounds ──
  const [sounds, setSounds] = useState<SoundLibrary[]>([])
  const [soundsLoading, setSoundsLoading] = useState(true)
  const [soundCat, setSoundCat] = useState<SoundCat>('alle')
  const [soundSearch, setSoundSearch] = useState('')
  const [bpmMin, setBpmMin] = useState('')
  const [bpmMax, setBpmMax] = useState('')
  const [displayLimit, setDisplayLimit] = useState(200)
  const [showAddSound, setShowAddSound] = useState(false)
  const [soundDraft, setSoundDraft] = useState<SoundDraft>(emptySound())
  const [addingSingle, setAddingSingle] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ imported: number } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)

  // ── Library scan ──
  type ScanResult = {
    library_path: string
    total_found: number
    already_imported: number
    new_files: number
    will_import: number
    limit: number
  }
  const [showScanModal, setShowScanModal] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanImporting, setScanImporting] = useState(false)
  const [scanImportResult, setScanImportResult] = useState<{ imported: number; remaining: number } | null>(null)

  // ── Fetchers ──

  const loadProjects = useCallback(async () => {
    setProjLoading(true)
    try {
      const res = await fetch('/api/musik/projects')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProjects(data)
    } catch (err) {
      console.error('[musik] load projects:', err)
    } finally {
      setProjLoading(false)
    }
  }, [])

  const loadSounds = useCallback(async () => {
    setSoundsLoading(true)
    try {
      const res = await fetch('/api/musik/sounds')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSounds(data)
    } catch (err) {
      console.error('[musik] load sounds:', err)
    } finally {
      setSoundsLoading(false)
    }
  }, [])

  useEffect(() => { void loadProjects() }, [loadProjects])
  useEffect(() => { void loadSounds() }, [loadSounds])

  // ── Project handlers ──

  function openEdit(p: MusicProject) {
    setEditProject(p)
    setEditDraft({
      title: p.title,
      bpm: p.bpm != null ? String(p.bpm) : '',
      musical_key: p.musical_key ?? '',
      scale: p.scale ?? '',
      genre: p.genre ?? '',
      mood: p.mood ?? '',
      status: p.status,
      collab: p.collab ?? '',
      notes: p.notes ?? '',
    })
  }

  function closeDrawer() {
    setEditProject(null)
    setEditDraft(null)
  }

  async function saveEdit() {
    if (!editProject || !editDraft) return
    setSaving(true)
    try {
      const res = await fetch(`/api/musik/projects/${editProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editDraft.title.trim(),
          bpm: editDraft.bpm ? Number(editDraft.bpm) : null,
          musical_key: editDraft.musical_key.trim() || null,
          scale: editDraft.scale.trim() || null,
          genre: editDraft.genre.trim() || null,
          mood: editDraft.mood.trim() || null,
          status: editDraft.status,
          collab: editDraft.collab.trim() || null,
          notes: editDraft.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProjects((prev) => prev.map((p) => (p.id === editProject.id ? data : p)))
      closeDrawer()
    } catch (err) {
      console.error('[musik] save edit:', err)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!editProject) return
    if (!confirm(`"${editProject.title}" wirklich löschen?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/musik/projects/${editProject.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setProjects((prev) => prev.filter((p) => p.id !== editProject.id))
      closeDrawer()
    } catch (err) {
      console.error('[musik] delete project:', err)
    } finally {
      setDeleting(false)
    }
  }

  async function submitQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!quickDraft.title.trim()) return
    setQuickSaving(true)
    try {
      const res = await fetch('/api/musik/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickDraft.title.trim(),
          bpm: quickDraft.bpm ? Number(quickDraft.bpm) : null,
          musical_key: quickDraft.musical_key.trim() || null,
          scale: quickDraft.scale.trim() || null,
          genre: quickDraft.genre.trim() || null,
          mood: quickDraft.mood.trim() || null,
          status: 'idea',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProjects((prev) => [data, ...prev])
      setQuickDraft(emptyQuick())
      setShowQuickAdd(false)
    } catch (err) {
      console.error('[musik] quick add:', err)
    } finally {
      setQuickSaving(false)
    }
  }

  // ── Sound handlers ──

  async function addSound(e: React.FormEvent) {
    e.preventDefault()
    if (!soundDraft.name.trim()) return
    setAddingSingle(true)
    try {
      const res = await fetch('/api/musik/sounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: soundDraft.name.trim(),
          category: soundDraft.category,
          tags: soundDraft.tags,
          bpm: soundDraft.bpm ? Number(soundDraft.bpm) : null,
          musical_key: soundDraft.musical_key.trim() || null,
          file_path: soundDraft.file_path.trim() || null,
          notes: soundDraft.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSounds((prev) => [data, ...prev])
      setSoundDraft(emptySound())
      setShowAddSound(false)
    } catch (err) {
      console.error('[musik] add sound:', err)
    } finally {
      setAddingSingle(false)
    }
  }

  async function deleteSound(id: string) {
    if (!confirm('Sound löschen?')) return
    try {
      const res = await fetch(`/api/musik/sounds/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setSounds((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('[musik] delete sound:', err)
    }
  }

  async function submitBulk() {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setBulkLoading(true)
    setBulkResult(null)
    try {
      const res = await fetch('/api/musik/sounds/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: lines }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBulkResult({ imported: data.imported })
      setBulkText('')
      await loadSounds()
    } catch (err) {
      console.error('[musik] bulk import:', err)
    } finally {
      setBulkLoading(false)
    }
  }

  // Stop audio when leaving sound view
  useEffect(() => {
    if (view !== 'sounds') {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingId(null)
    }
  }, [view])

  function togglePlay(sound: SoundLibrary) {
    if (!sound.file_path) return

    // Same sound — toggle pause/resume
    if (playingId === sound.id && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(console.error)
        setIsPaused(false)
      } else {
        audioRef.current.pause()
        setIsPaused(true)
      }
      return
    }

    // Different sound — stop current, start new
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    const url = `/api/musik/sounds/play?path=${encodeURIComponent(sound.file_path)}`
    const audio = new Audio(url)
    audioRef.current = audio
    setPlayingId(sound.id)
    setIsPaused(false)

    audio.play().catch((err) => {
      console.error('[play]', err)
      setPlayingId(null)
    })
    audio.onended = () => {
      setPlayingId(null)
      setIsPaused(false)
    }
  }

  async function openScanModal() {
    setShowScanModal(true)
    setScanResult(null)
    setScanError(null)
    setScanImportResult(null)
    setScanLoading(true)
    try {
      const res = await fetch('/api/musik/sounds/scan')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setScanResult(data)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      console.error('[scan] GET error:', err)
    } finally {
      setScanLoading(false)
    }
  }

  async function runCleanup() {
    setCleanupLoading(true)
    setCleanupResult(null)
    try {
      const res = await fetch('/api/musik/sounds/cleanup', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCleanupResult(data)
      await loadSounds()
      const res2 = await fetch('/api/musik/sounds/scan')
      if (res2.ok) setScanResult(await res2.json())
    } catch (err) {
      console.error('[cleanup]', err)
    } finally {
      setCleanupLoading(false)
    }
  }

  async function startScanImport() {
    if (!scanResult) return
    setScanImporting(true)
    setScanImportResult(null)
    try {
      const res = await fetch('/api/musik/sounds/scan', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setScanImportResult(data)
      await loadSounds()
      // refresh counts
      const res2 = await fetch('/api/musik/sounds/scan')
      if (res2.ok) setScanResult(await res2.json())
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Import fehlgeschlagen')
      console.error('[scan] POST error:', err)
    } finally {
      setScanImporting(false)
    }
  }

  function copyPath(path: string, id: string) {
    navigator.clipboard.writeText(path).catch(console.error)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  // ── Derived ──

  const genres = Array.from(
    new Set(projects.map((p) => p.genre).filter((g): g is string => !!g))
  ).sort()

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== 'alle' && p.status !== statusFilter) return false
    if (genreFilter !== 'alle' && p.genre !== genreFilter) return false
    return true
  })

  const soundCounts: Record<string, number> = {}
  for (const s of sounds) {
    soundCounts[s.category] = (soundCounts[s.category] ?? 0) + 1
  }

  const filteredSounds = sounds.filter((s) => {
    if (soundCat !== 'alle' && s.category !== soundCat) return false
    if (activeTagFilter && !s.tags?.includes(activeTagFilter)) return false
    if (soundSearch) {
      const q = soundSearch.toLowerCase()
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.musical_key?.toLowerCase().includes(q) &&
        !s.tags?.some((t) => t.toLowerCase().includes(q))
      ) return false
    }
    if (bpmMin && s.bpm != null && s.bpm < Number(bpmMin)) return false
    if (bpmMax && s.bpm != null && s.bpm > Number(bpmMax)) return false
    return true
  })

  const bulkLineCount = bulkText.split('\n').filter((l) => l.trim()).length

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <TopRail />

      {/* Tab switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0.25rem',
        padding: '1rem 1.5rem 0',
        borderBottom: '1px solid var(--line)',
      }}>
        {(['projekte', 'sounds'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
              padding: '0.5rem 1.25rem',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              cursor: 'pointer',
              background: view === v ? '#EFE7D6' : 'transparent',
              color: view === v ? 'var(--ink-0)' : 'var(--ink-3)',
              borderBottom: view === v ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {v === 'projekte' ? 'PROJEKTE' : 'SOUND LIBRARY'}
          </button>
        ))}
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.62rem',
          color: 'var(--ink-3)',
          paddingBottom: '0.6rem',
        }}>
          {view === 'projekte' ? `${filteredProjects.length} / ${projects.length}` : `${filteredSounds.length} / ${sounds.length}`}
        </span>
      </div>

      {/* ══ PROJEKTE VIEW ══ */}
      {view === 'projekte' && (
        <div style={{ padding: '1.25rem 1.5rem' }}>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            {(['alle', ...STATUS_ORDER] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.65rem',
                  letterSpacing: '0.04em',
                  padding: '0.3rem 0.7rem',
                  borderRadius: '20px',
                  border: '1px solid var(--line-strong)',
                  cursor: 'pointer',
                  background: statusFilter === s
                    ? (s === 'alle' ? 'var(--line)' : STATUS_CONFIG[s].bg)
                    : 'transparent',
                  color: statusFilter === s
                    ? (s === 'alle' ? 'var(--ink-0)' : STATUS_CONFIG[s].color)
                    : 'var(--ink-3)',
                }}
              >
                {s === 'alle' ? 'ALLE' : STATUS_CONFIG[s].label}
              </button>
            ))}

            {genres.length > 0 && (
              <select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
                style={{ ...inputStyle, width: 'auto', padding: '0.3rem 0.6rem', marginLeft: '0.5rem' }}
              >
                <option value="alle">Alle Genres</option>
                {genres.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}

            <button
              onClick={() => setShowQuickAdd((v) => !v)}
              style={{ ...btnGhost, marginLeft: 'auto', fontSize: '0.7rem' }}
            >
              {showQuickAdd ? '✕ ABBRECHEN' : '+ NEUES PROJEKT'}
            </button>
          </div>

          {/* Quick-add form */}
          {showQuickAdd && (
            <form
              onSubmit={submitQuickAdd}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto',
                gap: '0.5rem',
                alignItems: 'end',
                background: 'var(--line)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <label style={labelStyle}>TITEL *</label>
                <input
                  style={inputStyle}
                  placeholder="Beat title..."
                  value={quickDraft.title}
                  onChange={(e) => setQuickDraft((d) => ({ ...d, title: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>BPM</label>
                <input style={inputStyle} type="number" placeholder="140" value={quickDraft.bpm}
                  onChange={(e) => setQuickDraft((d) => ({ ...d, bpm: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>TONART</label>
                <input style={inputStyle} placeholder="Am" value={quickDraft.musical_key}
                  onChange={(e) => setQuickDraft((d) => ({ ...d, musical_key: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>SCALE</label>
                <select style={inputStyle} value={quickDraft.scale}
                  onChange={(e) => setQuickDraft((d) => ({ ...d, scale: e.target.value }))}>
                  <option value="">—</option>
                  {SCALES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>GENRE</label>
                <input style={inputStyle} placeholder="Drill" value={quickDraft.genre}
                  onChange={(e) => setQuickDraft((d) => ({ ...d, genre: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>MOOD</label>
                <input style={inputStyle} placeholder="dark" value={quickDraft.mood}
                  onChange={(e) => setQuickDraft((d) => ({ ...d, mood: e.target.value }))} />
              </div>
              <button type="submit" disabled={quickSaving} style={btnPrimary}>
                {quickSaving ? '...' : 'SAVE'}
              </button>
            </form>
          )}

          {/* Project grid */}
          {projLoading ? (
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)', padding: '3rem 0' }}>
              LADE PROJEKTE...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)', padding: '3rem 0' }}>
              {projects.length === 0 ? 'Noch keine Projekte. Klicke "+ NEUES PROJEKT" um anzufangen.' : 'Keine Projekte mit diesen Filtern.'}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '0.75rem',
            }}>
              {filteredProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => openEdit(p)}
                  style={{
                    background: 'var(--line)',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    padding: '0.9rem 1rem',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#EFE7D6' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--line)' }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--ink-0)', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                    <StatusBadge status={p.status} />
                    {p.bpm != null && <Tag>{p.bpm} BPM</Tag>}
                    {p.musical_key && <Tag>{p.musical_key}{p.scale ? ` ${p.scale}` : ''}</Tag>}
                    {p.genre && <Tag>{p.genre}</Tag>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {p.mood && <Tag>🎭 {p.mood}</Tag>}
                    {p.collab && <Tag>👥 {p.collab}</Tag>}
                  </div>
                  <div style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.6rem',
                    color: 'var(--ink-3)',
                    marginTop: '0.6rem',
                  }}>
                    {formatDate(p.updated_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ SOUND LIBRARY VIEW ══ */}
      {view === 'sounds' && (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 96px)' }}>

          {/* Sidebar */}
          <div style={{
            width: '180px',
            flexShrink: 0,
            borderRight: '1px solid var(--line)',
            paddingTop: '0.75rem',
          }}>
            <div style={{ padding: '0 0.75rem 0.5rem', fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
              KATEGORIEN
            </div>
            {(['alle', ...SOUND_CATEGORIES] as const).map((cat) => {
              const count = cat === 'alle' ? sounds.length : (soundCounts[cat] ?? 0)
              const active = soundCat === cat
              return (
                <button
                  key={cat}
                  onClick={() => { setSoundCat(cat); setDisplayLimit(200) }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.45rem 0.75rem',
                    background: active ? '#EFE7D6' : 'transparent',
                    border: 'none',
                    borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    color: active ? 'var(--ink-0)' : 'var(--ink-3)',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.72rem',
                    textAlign: 'left',
                    textTransform: 'uppercase',
                  }}
                >
                  <span>{cat}</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--ink-3)' }}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Main */}
          <div style={{ flex: 1, padding: '1rem 1.25rem', overflow: 'auto' }}>

            {/* Controls row */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <input
                style={{ ...inputStyle, flex: '1 1 200px', maxWidth: '280px' }}
                placeholder="🔍 Name, Tonart, Tag..."
                value={soundSearch}
                onChange={(e) => { setSoundSearch(e.target.value); setDisplayLimit(200) }}
              />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', color: 'var(--ink-3)' }}>BPM</span>
              <input
                style={{ ...inputStyle, width: '65px' }}
                type="number"
                placeholder="min"
                value={bpmMin}
                onChange={(e) => setBpmMin(e.target.value)}
              />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', color: 'var(--ink-3)' }}>—</span>
              <input
                style={{ ...inputStyle, width: '65px' }}
                type="number"
                placeholder="max"
                value={bpmMax}
                onChange={(e) => setBpmMax(e.target.value)}
              />
              <button onClick={() => setShowAddSound((v) => !v)} style={btnGhost}>
                {showAddSound ? '✕' : '+ SOUND'}
              </button>
              <button onClick={() => setShowBulkModal(true)} style={btnGhost}>
                ↑ BULK IMPORT
              </button>
              <button onClick={openScanModal} style={btnGhost}>
                📂 BIBLIOTHEK SCANNEN
              </button>
            </div>

            {/* Info bar: counters + active tag filter */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', fontFamily: 'ui-monospace, monospace', fontSize: '0.62rem', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
              <span>GESAMT <strong style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{sounds.length}</strong></span>
              {soundCat !== 'alle' && (
                <span>
                  {soundCat.toUpperCase()} <strong style={{ color: 'var(--accent)', fontWeight: 600 }}>{soundCounts[soundCat] ?? 0}</strong>
                </span>
              )}
              {activeTagFilter && (
                <>
                  <span>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>TAG</span>
                    <strong style={{ color: 'var(--warn)' }}>#{activeTagFilter}</strong>
                    <button
                      onClick={() => setActiveTagFilter(null)}
                      title="Filter aufheben"
                      style={{ background: 'var(--line)', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px' }}
                    >
                      ✕
                    </button>
                  </span>
                </>
              )}
              {filteredSounds.length !== sounds.length && (
                <span style={{ marginLeft: 'auto' }}>{filteredSounds.length} sichtbar</span>
              )}
            </div>

            {/* Add sound form */}
            {showAddSound && (
              <form
                onSubmit={addSound}
                style={{
                  background: 'var(--line)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '0.75rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '0.5rem',
                  alignItems: 'end',
                }}
              >
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>NAME *</label>
                  <input style={inputStyle} placeholder="kick_hard_001.wav" autoFocus
                    value={soundDraft.name} onChange={(e) => setSoundDraft((d) => ({ ...d, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>KATEGORIE *</label>
                  <select style={inputStyle} value={soundDraft.category}
                    onChange={(e) => setSoundDraft((d) => ({ ...d, category: e.target.value }))}>
                    {SOUND_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>BPM</label>
                  <input style={inputStyle} type="number" placeholder="140"
                    value={soundDraft.bpm} onChange={(e) => setSoundDraft((d) => ({ ...d, bpm: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>TONART</label>
                  <input style={inputStyle} placeholder="Am"
                    value={soundDraft.musical_key} onChange={(e) => setSoundDraft((d) => ({ ...d, musical_key: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>TAGS (komma)</label>
                  <input style={inputStyle} placeholder="hard, dark"
                    value={soundDraft.tags} onChange={(e) => setSoundDraft((d) => ({ ...d, tags: e.target.value }))} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>FILE PATH</label>
                  <input style={inputStyle} placeholder="/Sounds/Drums/kick_hard_001.wav"
                    value={soundDraft.file_path} onChange={(e) => setSoundDraft((d) => ({ ...d, file_path: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="submit" disabled={addingSingle} style={btnPrimary}>
                    {addingSingle ? '...' : 'SPEICHERN'}
                  </button>
                </div>
              </form>
            )}

            {/* Sound list */}
            {soundsLoading ? (
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)', padding: '2rem 0' }}>
                LADE SOUNDS...
              </div>
            ) : filteredSounds.length === 0 ? (
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-3)', padding: '2rem 0' }}>
                {sounds.length === 0
                  ? 'Noch keine Sounds. Klicke "+ SOUND" oder "↑ BULK IMPORT".'
                  : 'Keine Sounds mit diesen Filtern.'}
              </div>
            ) : (
              <div>
                {/* Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 90px 55px 60px 1fr 60px',
                  gap: '0.5rem',
                  padding: '0.3rem 0.4rem',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.6rem',
                  color: 'var(--ink-3)',
                  letterSpacing: '0.06em',
                  borderBottom: '1px solid #EFE7D6',
                  marginBottom: '0.2rem',
                }}>
                  <span>NAME</span><span>KAT.</span><span>BPM</span><span>KEY</span><span>TAGS</span><span></span>
                </div>
                {filteredSounds.slice(0, displayLimit).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 90px 55px 60px 1fr 60px',
                      gap: '0.5rem',
                      alignItems: 'center',
                      padding: '0.35rem 0.4rem',
                      borderRadius: '4px',
                      background: playingId === s.id ? '#F6ECE4' : 'transparent',
                      borderLeft: playingId === s.id ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                    onMouseEnter={(e) => { setHoveredId(s.id); if (playingId !== s.id) e.currentTarget.style.background = 'var(--line)' }}
                    onMouseLeave={(e) => { setHoveredId(null); if (playingId !== s.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Name cell with integrated play button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', overflow: 'hidden' }}>
                      {s.file_path ? (
                        <button
                          onClick={() => togglePlay(s)}
                          title={playingId === s.id && !isPaused ? 'Pause' : 'Abspielen'}
                          style={{
                            flexShrink: 0,
                            width: '18px',
                            height: '18px',
                            background: playingId === s.id
                              ? 'var(--accent)'
                              : hoveredId === s.id ? 'var(--line-strong)' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: playingId === s.id
                              ? 'var(--paper)'
                              : hoveredId === s.id ? 'var(--ink-1)' : 'transparent',
                            fontSize: '0.5rem',
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                          }}
                        >
                          {playingId === s.id && !isPaused ? '⏸' : '▶'}
                        </button>
                      ) : (
                        <span style={{ width: '18px', flexShrink: 0 }} />
                      )}
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', padding: '0.15rem 0.35rem', borderRadius: '3px', background: '#EFE7D6', color: 'var(--ink-2)', textAlign: 'center', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.category}
                    </span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-2)', textAlign: 'center' }}>
                      {s.bpm ?? '—'}
                    </span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-2)', textAlign: 'center' }}>
                      {s.musical_key ?? '—'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', overflow: 'hidden' }}>
                      {s.tags?.map((t, i) => (
                        <button
                          key={`${t}-${i}`}
                          onClick={() => { setActiveTagFilter(activeTagFilter === t ? null : t); setDisplayLimit(200) }}
                          title={activeTagFilter === t ? 'Filter aufheben' : `Nur "${t}" anzeigen`}
                          style={{
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '0.6rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '3px',
                            background: activeTagFilter === t ? '#F3E0D5' : '#EFE7D6',
                            color: activeTagFilter === t ? 'var(--accent)' : 'var(--ink-2)',
                            border: `1px solid ${activeTagFilter === t ? 'var(--accent)' : 'transparent'}`,
                            cursor: 'pointer',
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {s.file_path && (
                        <button
                          onClick={() => copyPath(s.file_path!, s.id)}
                          title="Pfad kopieren"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === s.id ? 'var(--ok)' : 'var(--ink-3)', fontSize: '0.72rem', padding: '0.1rem 0.25rem' }}
                        >
                          {copied === s.id ? '✓' : '📋'}
                        </button>
                      )}
                      <button
                        onClick={() => deleteSound(s.id)}
                        title="Löschen"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '0.72rem', padding: '0.1rem 0.25rem' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {filteredSounds.length > displayLimit && (
                  <div style={{ padding: '1rem 0', textAlign: 'center' }}>
                    <button
                      onClick={() => setDisplayLimit((n) => n + 200)}
                      style={{ ...btnGhost, fontSize: '0.7rem' }}
                    >
                      MEHR LADEN ({filteredSounds.length - displayLimit} weitere)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ EDIT DRAWER ══ */}
      {editProject && editDraft && (
        <>
          <div
            onClick={closeDrawer}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(44,34,24,0.45)',
              backdropFilter: 'blur(4px)',
              zIndex: 40,
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: '380px',
            background: 'var(--card)',
            borderLeft: '1px solid var(--line)',
            zIndex: 50,
            overflow: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                PROJEKT BEARBEITEN
              </span>
              <button onClick={closeDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '1.1rem' }}>
                ✕
              </button>
            </div>

            <div>
              <label style={labelStyle}>TITEL *</label>
              <input style={inputStyle} value={editDraft.title}
                onChange={(e) => setEditDraft((d) => d ? { ...d, title: e.target.value } : d)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={labelStyle}>BPM</label>
                <input style={inputStyle} type="number" placeholder="140" value={editDraft.bpm}
                  onChange={(e) => setEditDraft((d) => d ? { ...d, bpm: e.target.value } : d)} />
              </div>
              <div>
                <label style={labelStyle}>TONART</label>
                <input style={inputStyle} placeholder="Am" value={editDraft.musical_key}
                  onChange={(e) => setEditDraft((d) => d ? { ...d, musical_key: e.target.value } : d)} />
              </div>
              <div>
                <label style={labelStyle}>SCALE</label>
                <select style={inputStyle} value={editDraft.scale}
                  onChange={(e) => setEditDraft((d) => d ? { ...d, scale: e.target.value } : d)}>
                  <option value="">—</option>
                  {SCALES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>GENRE</label>
                <input style={inputStyle} placeholder="Drill" value={editDraft.genre}
                  onChange={(e) => setEditDraft((d) => d ? { ...d, genre: e.target.value } : d)} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>MOOD</label>
              <input style={inputStyle} placeholder="dark, aggressive" value={editDraft.mood}
                onChange={(e) => setEditDraft((d) => d ? { ...d, mood: e.target.value } : d)} />
            </div>

            <div>
              <label style={labelStyle}>COLLAB</label>
              <input style={inputStyle} placeholder="feat. Someone" value={editDraft.collab}
                onChange={(e) => setEditDraft((d) => d ? { ...d, collab: e.target.value } : d)} />
            </div>

            <div>
              <label style={labelStyle}>STATUS</label>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => setEditDraft((d) => d ? { ...d, status: s } : d)}
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.6rem',
                      letterSpacing: '0.04em',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      border: '1px solid ' + (editDraft.status === s ? STATUS_CONFIG[s].color : 'var(--line)'),
                      cursor: 'pointer',
                      background: editDraft.status === s ? STATUS_CONFIG[s].bg : 'transparent',
                      color: editDraft.status === s ? STATUS_CONFIG[s].color : 'var(--ink-3)',
                    }}
                  >
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>NOTIZEN</label>
              <textarea
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                value={editDraft.notes}
                onChange={(e) => setEditDraft((d) => d ? { ...d, notes: e.target.value } : d)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
              <button onClick={saveEdit} disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
                {saving ? 'SPEICHERT...' : 'SPEICHERN'}
              </button>
              <button onClick={confirmDelete} disabled={deleting} style={btnDanger}>
                {deleting ? '...' : 'LÖSCHEN'}
              </button>
            </div>

            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--ink-3)', borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
              Erstellt: {formatDate(editProject.created_at)} · Geändert: {formatDate(editProject.updated_at)}
            </div>
          </div>
        </>
      )}

      {/* ══ LIBRARY SCAN MODAL ══ */}
      {showScanModal && (
        <>
          <div
            onClick={() => { setShowScanModal(false); setScanImportResult(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(44,34,24,0.5)', backdropFilter: 'blur(4px)', zIndex: 40 }}
          />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '460px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '1.5rem',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                SAMPLE LIBRARY SCANNEN
              </span>
              <button onClick={() => { setShowScanModal(false); setScanImportResult(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '1.1rem' }}>
                ✕
              </button>
            </div>

            {scanLoading && (
              <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ink-2)', margin: 0 }}>
                SCANNE ORDNER...
              </p>
            )}

            {scanError && (
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem',
                color: 'var(--danger)', padding: '0.5rem 0.75rem',
                background: '#F3D8D8', borderRadius: '6px',
              }}>
                {scanError}
              </div>
            )}

            {scanResult && !scanLoading && (
              <>
                <div style={{
                  background: 'var(--line)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.62rem', color: 'var(--ink-3)', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
                    PFAD
                  </div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-1)', wordBreak: 'break-all' }}>
                    {scanResult.library_path}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  {[
                    { label: 'GESAMT', value: scanResult.total_found, color: 'var(--ink-1)' },
                    { label: 'BEREITS IMPORTIERT', value: scanResult.already_imported, color: 'var(--ok)' },
                    { label: 'NEU', value: scanResult.new_files, color: 'var(--accent)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      background: 'var(--line)',
                      border: '1px solid var(--line)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.4rem', fontWeight: 600, color }}>{value}</div>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.55rem', color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: '0.2rem' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {scanResult.new_files > scanResult.limit && (
                  <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--warn)', margin: 0 }}>
                    Limit: max. {scanResult.limit} Dateien pro Import. Danach erneut scannen.
                  </p>
                )}

                {scanImportResult && (
                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem',
                    color: 'var(--ok)', padding: '0.5rem 0.75rem',
                    background: '#E6EDD6', borderRadius: '6px',
                  }}>
                    ✓ {scanImportResult.imported} Sounds importiert
                    {scanImportResult.remaining > 0 && ` — noch ${scanImportResult.remaining} übrig`}
                  </div>
                )}

                {scanResult.new_files > 0 && (
                  <button
                    onClick={startScanImport}
                    disabled={scanImporting}
                    style={{ ...btnPrimary, opacity: scanImporting ? 0.6 : 1 }}
                  >
                    {scanImporting
                      ? `CLAUDE KATEGORISIERT... (kann 2–3 Min. dauern)`
                      : `${scanResult.will_import} SOUNDS IMPORTIEREN`}
                  </button>
                )}

                {scanResult.new_files === 0 && (
                  <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', color: 'var(--ok)', margin: 0 }}>
                    ✓ Alle Dateien bereits importiert.
                  </p>
                )}

                {/* Cleanup duplicates */}
                {sounds.length !== scanResult.already_imported && (
                  <div style={{
                    padding: '0.6rem 0.75rem',
                    background: '#F5E8CC',
                    border: '1px solid #F5E8CC',
                    borderRadius: '6px',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.72rem',
                    color: 'var(--warn)',
                  }}>
                    ⚠ {sounds.length - scanResult.already_imported > 0
                      ? `${sounds.length - scanResult.already_imported} Duplikate in der DB erkannt`
                      : 'Mögliche Duplikate erkannt'}
                  </div>
                )}
                {cleanupResult && (
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: 'var(--ok)', padding: '0.5rem 0.75rem', background: '#E6EDD6', borderRadius: '6px' }}>
                    ✓ {cleanupResult.deleted} Duplikate gelöscht
                  </div>
                )}
                <button
                  onClick={runCleanup}
                  disabled={cleanupLoading}
                  style={{ ...btnDanger, opacity: cleanupLoading ? 0.6 : 1, fontSize: '0.7rem' }}
                >
                  {cleanupLoading ? 'BEREINIGE...' : '🗑 DUPLIKATE BEREINIGEN'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* ══ BULK IMPORT MODAL ══ */}
      {showBulkModal && (
        <>
          <div
            onClick={() => { setShowBulkModal(false); setBulkResult(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(44,34,24,0.5)', backdropFilter: 'blur(4px)', zIndex: 40 }}
          />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '480px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '1.5rem',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                BULK IMPORT — CLAUDE HAIKU
              </span>
              <button onClick={() => { setShowBulkModal(false); setBulkResult(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '1.1rem' }}>
                ✕
              </button>
            </div>

            <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
              Dateinamen einfügen, einer pro Zeile. Claude erkennt Kategorie + Tags automatisch.
              BPM (60–200) und Tonart (z.B. Am, F#) werden aus dem Dateinamen geparst.
            </p>

            <div>
              <label style={labelStyle}>DATEINAMEN</label>
              <textarea
                style={{ ...inputStyle, minHeight: '160px', resize: 'vertical' }}
                placeholder={'kick_140bpm_hard.wav\nbassline_Am_trap.wav\nsynth_lead_Fm_dark.wav'}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
            </div>

            {bulkResult && (
              <div style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.75rem',
                color: 'var(--ok)',
                padding: '0.5rem 0.75rem',
                background: '#E6EDD6',
                borderRadius: '6px',
              }}>
                ✓ {bulkResult.imported} Sounds erfolgreich importiert
              </div>
            )}

            <button
              onClick={submitBulk}
              disabled={bulkLoading || !bulkText.trim()}
              style={{ ...btnPrimary, opacity: bulkLoading || !bulkText.trim() ? 0.5 : 1 }}
            >
              {bulkLoading
                ? 'CLAUDE ANALYSIERT...'
                : `IMPORTIEREN (${bulkLineCount} Sound${bulkLineCount !== 1 ? 's' : ''})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

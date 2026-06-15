'use client'

import { useState, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type FileStatus = 'checking' | 'new' | 'existing' | 'done' | 'error'

type FileItem = {
  file: File
  status: FileStatus
  existingChunks?: number
  selected: boolean
  result?: { ok: number; failed: number }
}

type Progress = {
  filename: string
  chunk: number
  total: number
}

// ── Text-Chunking (identisch zur CLI) ─────────────────────────────────────────

function chunkText(text: string, wordsPerChunk = 2000): string[] {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const paragraphs = cleaned.split(/\n\n+/)
  const chunks: string[] = []
  let current: string[] = []
  let wordCount = 0

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue
    const words = trimmed.split(/\s+/).length
    if (wordCount + words > wordsPerChunk && current.length > 0) {
      chunks.push(current.join('\n\n'))
      current = [trimmed]
      wordCount = words
    } else {
      current.push(trimmed)
      wordCount += words
    }
  }
  if (current.length > 0) chunks.push(current.join('\n\n'))
  return chunks.filter((c) => c.split(/\s+/).length >= 80)
}

// ── PDF-Text-Extraktion im Browser (pdfjs-dist) ───────────────────────────────

async function extractTextFromPdf(file: File): Promise<{ text: string; pages: number }> {
  // Dynamic import — lädt nur client-side, kein SSR
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 }).promise

  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    fullText += pageText + '\n\n'
    await page.cleanup()
  }
  await pdf.destroy()

  return { text: fullText, pages: pdf.numPages }
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function PdfImporter({ onImportDone }: { onImportDone?: () => void }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<FileItem[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Nach Dateiauswahl: Quellen-Status vom Server laden
  const handleFilesSelected = useCallback(async (list: FileList) => {
    const initial: FileItem[] = Array.from(list).map((f) => ({
      file: f,
      status: 'checking',
      selected: true,
    }))
    setItems(initial)

    try {
      const res = await fetch('/api/knowledge/sources')
      if (!res.ok) throw new Error()
      const sources: { filename: string; chunks: number }[] = await res.json()
      const map = new Map(sources.map((s) => [s.filename, s.chunks]))

      setItems(
        initial.map((fi) => {
          const existing = map.get(fi.file.name)
          return {
            ...fi,
            status: existing ? 'existing' : 'new',
            existingChunks: existing,
          }
        }),
      )
    } catch {
      setItems(initial.map((fi) => ({ ...fi, status: 'new' })))
    }
  }, [])

  const toggleSelected = (name: string) => {
    setItems((prev) =>
      prev.map((fi) =>
        fi.file.name === name ? { ...fi, selected: !fi.selected } : fi,
      ),
    )
  }

  const handleImport = async () => {
    const toImport = items.filter((fi) => fi.status === 'new' && fi.selected)
    if (!toImport.length || importing) return

    setImporting(true)

    for (const fi of toImport) {
      const filename = fi.file.name

      // Text extrahieren
      let text: string
      try {
        const { text: t } = await extractTextFromPdf(fi.file)
        text = t
      } catch (err) {
        console.error('[pdf-import] PDF-Parse Fehler:', filename, err)
        setItems((prev) =>
          prev.map((x) => (x.file.name === filename ? { ...x, status: 'error' } : x)),
        )
        continue
      }

      const chunks = chunkText(text)
      let ok = 0
      let failed = 0

      for (let i = 0; i < chunks.length; i++) {
        setProgress({ filename, chunk: i + 1, total: chunks.length })

        try {
          const res = await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              raw_text: `[Quelle: ${filename} — Abschnitt ${i + 1}/${chunks.length}]\n\n${chunks[i]}`,
              category: 'Zahnmedizin',
              source: `pdf:${filename}`,
            }),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          ok++
        } catch (err) {
          console.error('[pdf-import] Chunk-Fehler:', filename, i, err)
          failed++
        }
      }

      setItems((prev) =>
        prev.map((x) =>
          x.file.name === filename
            ? { ...x, status: failed === 0 ? 'done' : 'error', result: { ok, failed } }
            : x,
        ),
      )
    }

    setProgress(null)
    setImporting(false)
    onImportDone?.()
  }

  const newCount = items.filter((fi) => fi.status === 'new' && fi.selected).length
  const hasFiles = items.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Toggle-Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'transparent',
          border: '1px solid var(--line)',
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          color: 'var(--ink-2)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.75rem',
          letterSpacing: '0.06em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          transition: 'all 0.12s',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <span>PDF-QUELLEN VERWALTEN</span>
        <span style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          marginTop: '0.5rem',
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          padding: '1.25rem',
          backdropFilter: 'blur(8px)',
        }}>

          {/* Datei-Picker */}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
          />

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: hasFiles ? '1rem' : 0 }}>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={importing}
              style={{
                background: 'var(--line)',
                border: '1px solid var(--line-strong)',
                borderRadius: '7px',
                padding: '0.55rem 1.1rem',
                color: 'var(--ink-1)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.78rem',
                letterSpacing: '0.05em',
                cursor: importing ? 'not-allowed' : 'pointer',
                opacity: importing ? 0.5 : 1,
              }}
            >
              PDFs AUSWÄHLEN
            </button>

            {hasFiles && (
              <button
                onClick={handleImport}
                disabled={newCount === 0 || importing}
                style={{
                  background: newCount > 0 && !importing ? 'var(--accent)' : 'var(--line-strong)',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '0.55rem 1.1rem',
                  color: newCount > 0 && !importing ? '#FBF3EC' : 'var(--ink-3)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  cursor: newCount === 0 || importing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {importing ? 'IMPORTIERT...' : `${newCount} NEUE IMPORTIEREN`}
              </button>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div style={{
              marginBottom: '0.75rem',
              padding: '0.6rem 0.875rem',
              background: '#F6ECE4',
              border: '1px solid var(--accent)',
              borderRadius: '6px',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.75rem',
              color: 'var(--accent)',
            }}>
              ↑ {progress.filename} — Abschnitt {progress.chunk}/{progress.total}
              {/* Progress bar */}
              <div style={{
                marginTop: '0.4rem',
                height: '2px',
                background: 'var(--line)',
                borderRadius: '1px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round((progress.chunk / progress.total) * 100)}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.2s',
                }} />
              </div>
            </div>
          )}

          {/* Dateiliste */}
          {hasFiles && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {items.map((fi) => (
                <div
                  key={fi.file.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--line)',
                    border: `1px solid ${
                      fi.status === 'done'     ? '#E6EDD6' :
                      fi.status === 'error'    ? '#F3D8D8' :
                      fi.status === 'existing' ? 'var(--line)' :
                                                 '#F3E0D5'
                    }`,
                    borderRadius: '6px',
                  }}
                >
                  {/* Checkbox (nur für neue) */}
                  {fi.status === 'new' && (
                    <input
                      type="checkbox"
                      checked={fi.selected}
                      onChange={() => toggleSelected(fi.file.name)}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                    />
                  )}

                  {/* Status-Icon */}
                  <span style={{
                    fontSize: '0.75rem',
                    flexShrink: 0,
                    color:
                      fi.status === 'checking' ? 'var(--ink-3)' :
                      fi.status === 'new'      ? 'var(--accent)' :
                      fi.status === 'existing' ? 'var(--ok)' :
                      fi.status === 'done'     ? 'var(--ok)' :
                                                 'var(--danger)',
                  }}>
                    {fi.status === 'checking' ? '○' :
                     fi.status === 'new'      ? '●' :
                     fi.status === 'existing' ? '✓' :
                     fi.status === 'done'     ? '✓' : '✗'}
                  </span>

                  {/* Dateiname */}
                  <span style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.78rem',
                    color: fi.status === 'existing' ? 'var(--ink-3)' : 'var(--ink-1)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {fi.file.name}
                  </span>

                  {/* Rechte Info */}
                  <span style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.7rem',
                    color: 'var(--ink-3)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    {fi.status === 'checking'                          ? 'prüfe...' :
                     fi.status === 'existing' && fi.existingChunks    ? `${fi.existingChunks} Abschnitte` :
                     fi.status === 'new'                               ? `${(fi.file.size / 1024 / 1024).toFixed(1)} MB` :
                     fi.status === 'done' && fi.result                ? `✓ ${fi.result.ok} Abschnitte` :
                     fi.status === 'error' && fi.result               ? `✗ ${fi.result.failed} Fehler` :
                     fi.status === 'error'                             ? '✗ Parse-Fehler' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Leerstand */}
          {!hasFiles && (
            <p style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.75rem',
              color: 'var(--ink-3)',
              margin: '0.75rem 0 0',
            }}>
              PDFs auswählen → neue werden erkannt → Import starten
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Zentrale Obsidian-Helfer: tägliches Live-Logbuch.
// appendToDailyLog() wird von Telegram-Webhook, Garmin-Sync und knowledge.ts aufgerufen.
// Alle Schreibvorgänge sind best-effort und non-blocking (callers rufen `void` auf).

const SECTION_HEADERS = {
  garmin: '## 🏃 Training (Garmin)',
  note: '## 📝 Notizen',
  document: '## 📄 Dokumente',
} as const

type LogKind = keyof typeof SECTION_HEADERS

const GERMAN_MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function germanDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${String(d).padStart(2, '0')}. ${GERMAN_MONTHS[(m ?? 1) - 1]} ${y}`
}

/** Gibt das aktuelle Datum + Uhrzeit in der Europe/Berlin-Zeitzone zurück. */
export function berlinNow(): { dateKey: string; timeBerlin: string } {
  const now = new Date()
  const dateKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now)
  const timeBerlin = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
  return { dateKey, timeBerlin }
}

async function obsidianGet(vaultPath: string): Promise<string | null> {
  const url = process.env.OBSIDIAN_API_URL
  const key = process.env.OBSIDIAN_API_KEY
  if (!url || !key) return null
  const encoded = vaultPath.split('/').map(encodeURIComponent).join('/')
  try {
    const res = await fetch(`${url}/vault/${encoded}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.status === 404) return ''
    if (!res.ok) { console.error('[obsidian] GET failed:', res.status); return null }
    return await res.text()
  } catch (err) {
    console.error('[obsidian] GET unreachable:', err)
    return null
  }
}

/** Schreibt oder überschreibt eine Markdown-Datei im Vault (best-effort). */
export async function writeObsidianFile(vaultPath: string, content: string): Promise<void> {
  await obsidianPut(vaultPath, content)
}

async function obsidianPut(vaultPath: string, content: string): Promise<void> {
  const url = process.env.OBSIDIAN_API_URL
  const key = process.env.OBSIDIAN_API_KEY
  if (!url || !key) return
  const encoded = vaultPath.split('/').map(encodeURIComponent).join('/')
  try {
    const res = await fetch(`${url}/vault/${encoded}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'text/markdown' },
      body: content,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) console.error('[obsidian] PUT failed:', res.status)
  } catch (err) {
    console.error('[obsidian] PUT unreachable:', err)
  }
}

/**
 * Fügt einen Eintrag in den bestehenden Logbuch-Content ein.
 * - garmin: ersetzt die gesamte Training-Sektion (idempotent bei Re-Sync)
 * - note/document: hängt eine Zeile an (überspringt Duplikate derselben Minute)
 */
function mergeLogEntry(
  existing: string,
  kind: LogKind,
  newLines: string[],
  time: string,
  dateKey: string,
): string {
  const header = SECTION_HEADERS[kind]

  // Neue Datei: mit Datumsüberschrift beginnen
  const base = existing.trim() || `# ${germanDate(dateKey)}`
  const lines = base.split('\n')

  const headerIdx = lines.findIndex((l) => l === header)

  if (headerIdx !== -1) {
    // Abschnitt gefunden — Ende bestimmen (nächster ## oder # Header)
    let endIdx = lines.length
    for (let i = headerIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ') || (lines[i].startsWith('# ') && !lines[i].startsWith('## '))) {
        endIdx = i
        break
      }
    }

    if (kind === 'garmin') {
      // Gesamten Abschnitt ersetzen
      const bullets = newLines.map((l) => `- ${l}`)
      return [...lines.slice(0, headerIdx + 1), ...bullets, '', ...lines.slice(endIdx)].join('\n')
    }

    // note / document: anhängen wenn kein Duplikat der gleichen Minute
    const newLine = `- ${time} ${newLines[0]}`
    if (lines.slice(headerIdx + 1, endIdx).some((l) => l.startsWith(`- ${time}`))) {
      return base // Duplikat, überspringen
    }

    // Vor den Leerzeilen am Abschnittsende einfügen
    let insertAt = endIdx
    while (insertAt > headerIdx + 1 && lines[insertAt - 1].trim() === '') {
      insertAt--
    }
    return [...lines.slice(0, insertAt), newLine, ...lines.slice(insertAt)].join('\n')
  }

  // Abschnitt fehlt — ans Ende anfügen
  const bullets =
    kind === 'garmin'
      ? newLines.map((l) => `- ${l}`).join('\n')
      : `- ${time} ${newLines[0]}`
  return `${base}\n\n${header}\n${bullets}\n`
}

/**
 * Schreibt einen Eintrag ins tägliche Logbuch (`Logbuch/JJJJ/MM/JJJJ-MM-TT.md`).
 * Non-blocking: Aufrufer benutzen `void appendToDailyLog(...)`.
 *
 * @param entry.kind     'note' | 'document' | 'garmin'
 * @param entry.timeBerlin  'HH:MM' in Europe/Berlin
 * @param entry.dateKey  'YYYY-MM-DD'
 * @param entry.content  Für garmin: zeilengetrennte Bullet-Texte; für note/doc: eine Zeile
 */
export async function appendToDailyLog(entry: {
  kind: 'note' | 'document' | 'garmin'
  timeBerlin: string
  dateKey: string
  category?: string
  content: string
}): Promise<void> {
  const [y, m] = entry.dateKey.split('-')
  const vaultPath = `Logbuch/${y}/${m}/${entry.dateKey}.md`

  const existingOrNull = await obsidianGet(vaultPath)
  if (existingOrNull === null) return // Obsidian nicht erreichbar

  const newLines = entry.content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (newLines.length === 0) return

  const merged = mergeLogEntry(existingOrNull, entry.kind, newLines, entry.timeBerlin, entry.dateKey)
  await obsidianPut(vaultPath, merged)
}

// _Eingang-Ingestion: verarbeitet Dateien, die du in den Vault-Ordner `_Eingang/` legst.
// Pro Datei: Claude klassifiziert (Ziel-Bereich + Kategorie + Titel + Zusammenfassung),
// das ORIGINAL wird in den passenden Obsidian-Unterordner verschoben, und der TEXT +
// ein OpenAI-Embedding landen in Supabase `knowledge_entries` (→ RAG-suchbar).
//
// Läuft LOKAL auf dem PC (arbeitet direkt auf dem Vault-Dateisystem).
// Unterstützt: .pdf  .txt  .md  .jpg/.jpeg/.png/.webp
//
// Voraussetzung: .env.local mit ANTHROPIC_API_KEY, OPENAI_API_KEY,
//                NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Aufruf:
//   node scripts/eingang-ingest.mjs
//   node scripts/eingang-ingest.mjs --dry-run     (nur klassifizieren + Plan zeigen)
//   node scripts/eingang-ingest.mjs --keep        (Original NICHT aus _Eingang löschen)
//   node scripts/eingang-ingest.mjs --vault "D:\Obsidian Vault"

import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import { PDFParse } from 'pdf-parse'

dotenv.config({ path: '.env.local', override: true, quiet: true })

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMBED_MODEL = 'text-embedding-3-small'

if (!ANTHROPIC_API_KEY || !OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Fehlende Env Vars: ANTHROPIC_API_KEY, OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const hasFlag = (n) => process.argv.includes(`--${n}`)

const VAULT = arg('vault', 'D:\\Obsidian Vault')
const EINGANG = path.join(VAULT, '_Eingang')
const DRY_RUN = hasFlag('dry-run')
const KEEP = hasFlag('keep')

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const TEXT_EXT = new Set(['.txt', '.md'])
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const PDF_EXT = new Set(['.pdf'])

// ── Helfer ────────────────────────────────────────────────────────────────────
function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}
function slugify(text, maxLen = 50) {
  return (
    text
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, maxLen) || 'dokument'
  )
}
function imgMediaType(ext) {
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}
function mimeFromExt(ext) {
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.txt' || ext === '.md') return 'text/plain'
  return 'image/jpeg'
}

const STORAGE_BUCKET = 'documents'

/** Lädt das Original in den Supabase-Storage-Tresor — NUR Gesundheit/Verwaltung.
 *  Literatur/Recherche/Lernstoff bleibt im Vault (nicht in den Tresor). */
async function uploadOriginalToTresor(area, target, base, ext, buffer) {
  let storagePath = null
  if (area === 'gesundheit') {
    storagePath = `gesundheit/${base}${ext}`
  } else if (area === 'verwaltung') {
    const kat = target.folder.split('/')[1] || 'Sonstiges'
    storagePath = `verwaltung/${kat}/${base}${ext}`
  } else {
    return null // Literatur/Recherche → kein Tresor
  }
  const { error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeFromExt(ext), upsert: true })
  if (error) {
    console.warn(`  ⚠ Tresor-Upload fehlgeschlagen: ${error.message}`)
    return null
  }
  return storagePath
}
function parseClaudeJson(raw) {
  try {
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch (e) {
    console.error('  JSON-Parse-Fehler:', e.message, '-', raw.slice(0, 120))
    return null
  }
}

// Sync mit lib/obsidianPaths.ts
const ZAHNMEDIZIN_FOLDER = 'Literatur/Medizin/Zahnmedizin'

// Bereich + Kategorie → Obsidian-Unterordner + knowledge_entries.category
function resolveTarget(area, category) {
  const a = (area || '').toLowerCase()
  const c = (category || '').toLowerCase()
  if (a === 'gesundheit') return { folder: 'Gesundheit/Dokumente', knowledgeCategory: 'Gesundheit' }
  if (a === 'verwaltung') {
    const valid = ['Versicherung', 'Arbeit', 'Amt', 'Finanzen', 'Wohnen', 'Datenbank', 'Sonstiges']
    let kat = valid.includes(category) ? category : 'Sonstiges'
    const cLow = (category || '').toLowerCase()
    if (kat === 'Sonstiges' && /pass|visum|impf|reisepass|flug|boarding|hotel|buchung|ticket|ausweis|mietwagen|bahn/.test(cLow)) {
      kat = 'Datenbank'
    }
    return { folder: `Verwaltung/${kat}`, knowledgeCategory: 'Verwaltung' }
  }
  if (a === 'literatur') {
    const med = /zahn|medizin|mkg|chirurg|anatom|patho|pharma|klinik/.test(c)
    if (/zahn|mkg/.test(c)) {
      return { folder: ZAHNMEDIZIN_FOLDER, knowledgeCategory: 'Zahnmedizin' }
    }
    return { folder: med ? 'Literatur/Medizin' : 'Literatur/Allgemein', knowledgeCategory: category || 'Allgemein' }
  }
  // recherche / Standard → Lebensbereich
  if (/zahn|mkg/.test(c)) return { folder: ZAHNMEDIZIN_FOLDER, knowledgeCategory: 'Zahnmedizin' }
  if (/musik|fl studio|sampl/.test(c)) return { folder: 'Musik', knowledgeCategory: category || 'Musikproduktion' }
  if (/triathlon|kraft|ernähr|ernaehr/.test(c)) return { folder: 'Gesundheit/Recherche', knowledgeCategory: category || 'Allgemein' }
  return { folder: 'Recherche', knowledgeCategory: category || 'Allgemein' }
}

const CLASSIFY_SYSTEM = `Du sortierst ein Dokument in ein persönliches Wissens-Archiv ein.
Gib AUSSCHLIESSLICH valides JSON zurück, keine Erklärung:
{
  "area": "gesundheit" | "verwaltung" | "literatur" | "recherche",
  "category": "freier Kategoriename / Lebensbereich (z.B. Zahnmedizin, Triathlon, Musikproduktion, Versicherung, Amt, Allgemein)",
  "title": "kurzer deutscher Titel, max 60 Zeichen, dateinamen-tauglich",
  "summary": "1-2 Sätze deutsche Zusammenfassung",
  "tags": ["max 5 kleingeschriebene deutsche Tags"]
}

Regeln für "area":
- "gesundheit": Blutbild, Laborbefund, Laktattest, Arztbefund, medizinischer Eigenbefund.
- "verwaltung": offizielle/bürokratische Dokumente. category = Versicherung|Arbeit|Amt|Finanzen|Wohnen|Datenbank|Sonstiges. Datenbank = Pass/Visum/Impfung/Flug/Hotel/Buchungs-PDFs.
- "literatur": Fachliteratur, Lehrbuch-Auszug, wissenschaftlicher Artikel, Buch.
- "recherche": eigene Notizen/Dumps/Wissen zu einem Lebensbereich (Zahnmedizin, Triathlon, Krafttraining, Ernährung, Musikproduktion, Allgemein).`

async function classify({ kind, text, buffer, ext }) {
  const content = []
  if (kind === 'image') {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: imgMediaType(ext), data: buffer.toString('base64') },
    })
    content.push({ type: 'text', text: 'Klassifiziere dieses Dokument.' })
  } else if (kind === 'pdf' && buffer && (!text || text.trim().length < 30)) {
    // Gescanntes PDF ohne Textebene → als PDF-Dokument an Claude.
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } })
    content.push({ type: 'text', text: 'Klassifiziere dieses Dokument.' })
  } else {
    content.push({ type: 'text', text: `Klassifiziere dieses Dokument. Auszug:\n\n${(text || '').slice(0, 4000)}` })
  }

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: 'user', content }],
  })
  const tb = msg.content.find((c) => c.type === 'text')
  return tb ? parseClaudeJson(tb.text) : null
}

async function embed(input) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: input.slice(0, 6000) }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  return (await res.json()).data[0].embedding
}

// ── Hauptlauf ─────────────────────────────────────────────────────────────────
if (!fs.existsSync(EINGANG)) {
  console.error(`_Eingang-Ordner nicht gefunden: ${EINGANG}\n(Über --vault den Vault-Pfad setzen.)`)
  process.exit(1)
}

const allFiles = fs
  .readdirSync(EINGANG, { withFileTypes: true })
  .filter((e) => e.isFile() && !e.name.startsWith('.'))
  .map((e) => e.name)

const files = allFiles.filter((n) => {
  const ext = path.extname(n).toLowerCase()
  return TEXT_EXT.has(ext) || IMG_EXT.has(ext) || PDF_EXT.has(ext)
})

console.log(`\n=== _Eingang Ingestion ===`)
console.log(`Ordner: ${EINGANG}`)
console.log(`Dateien: ${files.length}${allFiles.length !== files.length ? ` (${allFiles.length - files.length} übersprungen, nicht unterstützt)` : ''}  ${DRY_RUN ? '(DRY-RUN)' : ''}\n`)

let done = 0
const errors = []

for (const name of files) {
  const ext = path.extname(name).toLowerCase()
  const srcPath = path.join(EINGANG, name)
  const kind = IMG_EXT.has(ext) ? 'image' : PDF_EXT.has(ext) ? 'pdf' : 'text'
  console.log(`• ${name}  [${kind}]`)

  try {
    const buffer = fs.readFileSync(srcPath)

    // Duplikat-Schutz: identische Datei schon archiviert? (vor dem Claude-Call)
    const contentHash = createHash('sha256').update(new Uint8Array(buffer)).digest('hex')
    const { data: dup } = await sb
      .from('knowledge_entries')
      .select('id, summary')
      .eq('content_hash', contentHash)
      .limit(1)
      .maybeSingle()
    if (dup) {
      console.log(`  ⏭ Duplikat (bereits archiviert: "${dup.summary ?? ''}") — übersprungen, Original bleibt in _Eingang.`)
      continue
    }

    // Text extrahieren
    let text = ''
    if (kind === 'text') {
      text = buffer.toString('utf8')
    } else if (kind === 'pdf') {
      try {
        const result = await new PDFParse({ data: buffer }).getText()
        text = result.text ?? ''
      } catch (e) {
        console.warn(`  ⚠ PDF-Text nicht lesbar (${e.message}) → Claude liest das PDF direkt.`)
      }
    }

    // Klassifizieren
    const cls = await classify({ kind, text, buffer, ext })
    if (!cls || !cls.area) {
      throw new Error('Klassifizierung fehlgeschlagen (kein gültiges JSON).')
    }
    const target = resolveTarget(cls.area, cls.category)
    const title = (cls.title || path.basename(name, ext)).trim().slice(0, 60)
    const summary = (cls.summary || '').trim()
    const tags = Array.isArray(cls.tags) ? cls.tags.slice(0, 5).map(String) : []
    const dateKey = todayKey()
    const base = `${dateKey}-${slugify(title)}`

    console.log(`  → ${cls.area}/${cls.category}  →  ${target.folder}/${base}`)
    if (summary) console.log(`    "${summary}"`)

    if (DRY_RUN) { done++; continue }

    // Ziel-Ordner anlegen
    const targetDirAbs = path.join(VAULT, ...target.folder.split('/'))
    fs.mkdirSync(targetDirAbs, { recursive: true })

    // raw_text für RAG (Bild ohne Text → Zusammenfassung nutzen)
    const rawText = text && text.trim().length > 0 ? text : summary || title

    if (kind === 'text') {
      // Textdatei: als Notiz mit Frontmatter ablegen (Datei selbst ist der Inhalt).
      const note = `---\ndate: ${dateKey}\ncategory: ${target.knowledgeCategory}\nsource: eingang\ntags: [${tags.join(', ')}]\n---\n# ${title}\n\n${text}`
      fs.writeFileSync(path.join(targetDirAbs, `${base}.md`), note, 'utf8')
    } else {
      // PDF/Bild: Original ablegen + Index-Notiz mit Embed.
      fs.writeFileSync(path.join(targetDirAbs, `${base}${ext}`), buffer)
      const note = `---\ndate: ${dateKey}\ncategory: ${target.knowledgeCategory}\nsource: eingang\ntags: [${tags.join(', ')}]\n---\n# ${title}\n\n${summary}\n\n![[${base}${ext}]]\n`
      fs.writeFileSync(path.join(targetDirAbs, `${base}.md`), note, 'utf8')
    }

    // Gesundheit/Verwaltung-Originale zusätzlich in den Tresor (→ per /hol abrufbar).
    const storagePath = await uploadOriginalToTresor(cls.area, target, base, ext, buffer)
    if (storagePath) console.log(`    ⬆ Tresor: ${storagePath}`)

    // Supabase: knowledge_entries + Embedding
    const { data: row, error: insErr } = await sb
      .from('knowledge_entries')
      .insert({
        raw_text: rawText.slice(0, 50000),
        category: target.knowledgeCategory,
        summary: summary || title,
        tags,
        source: 'eingang',
        user_id: 'me',
        content_hash: contentHash,
        storage_path: storagePath,
      })
      .select('id')
      .single()
    if (insErr) throw new Error(`Supabase insert: ${insErr.message}`)

    try {
      const vec = await embed(`${summary}\n\n${rawText}`)
      const { error: embErr } = await sb.from('knowledge_entries').update({ embedding: vec }).eq('id', row.id)
      if (embErr) console.warn(`  ⚠ Embedding-Update: ${embErr.message} (Backfill heilt es später)`)
    } catch (e) {
      console.warn(`  ⚠ Embedding fehlgeschlagen: ${e.message} (Backfill heilt es später)`)
    }

    // Original aus _Eingang entfernen (nach erfolgreichem Schreiben)
    if (!KEEP) fs.unlinkSync(srcPath)

    console.log(`  ✓ abgelegt + indexiert${KEEP ? ' (Original behalten)' : ''}`)
    done++
  } catch (e) {
    errors.push(`${name}: ${e.message}`)
    console.warn(`  ✗ ${e.message}`)
  }
}

console.log(`\n=== Fertig ===`)
console.log(`${DRY_RUN ? 'Würde verarbeiten' : 'Verarbeitet'}: ${done}/${files.length}   Fehler: ${errors.length}`)
if (errors.length) for (const e of errors.slice(0, 10)) console.log(`  - ${e}`)

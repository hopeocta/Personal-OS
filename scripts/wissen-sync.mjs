// Bidirektionaler Sync: Supabase knowledge_entries ↔ Obsidian Literatur/Wissen/
//
// Ordnerstruktur im Vault:
//   Literatur/Wissen/{Kategorie}/Aktiv/   ← context: true  → im RAG + Chat-Kontext
//   Literatur/Wissen/{Kategorie}/Archiv/  ← context: false → sichtbar, nicht im RAG
//
// Aufruf:
//   node scripts/wissen-sync.mjs             (Export + Import)
//   node scripts/wissen-sync.mjs --export    (nur Supabase → Obsidian)
//   node scripts/wissen-sync.mjs --import    (nur Obsidian → Supabase)
//   node scripts/wissen-sync.mjs --dry-run
//   node scripts/wissen-sync.mjs --force     (überschreibt existierende Dateien)
//
// Regeln:
//   - Datei in Aktiv/  → Supabase context=true
//   - Datei in Archiv/ → Supabase context=false
//   - Datei verschieben (gleiche id) → context wird beim nächsten Import gespiegelt
//   - Keine Löschung aus Supabase — nur context-Feld updaten
//   - Neue Datei ohne id → neuer Supabase-Eintrag

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Fehlende Env Vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const hasFlag = (n) => process.argv.includes(`--${n}`)
const argVal = (n, fb) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fb }

const VAULT     = argVal('vault', 'D:\\Obsidian Vault')
const DRY       = hasFlag('dry-run')
const FORCE     = hasFlag('force')
const DO_EXPORT = !hasFlag('import')
const DO_IMPORT = !hasFlag('export')

const WISSEN_BASE    = 'Literatur/Wissen'
const MANIFEST_PATH  = path.join(__dirname, '.wissen-manifest.json')

// Kategorien die nach Literatur/Wissen/ exportiert werden
// KI/Skills sind NICHT hier — die gehen in den top-level KI/-Ordner (knowledge-obsidian-sync.mjs)
const EXPORT_CATEGORIES = new Set(['Zahnmedizin', 'Allgemein', 'Projekte', 'Soziales', 'Training-relevant'])

// Quellen die nach Archiv/ kommen (context: false by default)
const ARCHIV_SOURCES = new Set(['pdf-pipeline', 'doc_backfill'])

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
const TZ = 'Europe/Berlin'

// ── Helpers ────────────────────────────────────────────────────────────────────

const berlinDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d))
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')
const slug50 = (s) =>
  (s || '').toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 50) || 'notiz'

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) } catch { return {} }
}
function saveManifest(m) {
  if (!DRY) fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2), 'utf8')
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return { meta: {}, body: content }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const ci = line.indexOf(':')
    if (ci < 0) continue
    const key = line.slice(0, ci).trim()
    let val = line.slice(ci + 1).trim()
    if (val === 'true') val = true
    else if (val === 'false') val = false
    if (key) meta[key] = val
  }
  return { meta, body: content.slice(match[0].length).trim() }
}

function isArchivSource(source) {
  return ARCHIV_SOURCES.has(source)
}

function entryVaultPath(entry) {
  const date   = berlinDate(entry.created_at)
  const title  = (entry.summary || (entry.raw_text || '').slice(0, 60) || 'Notiz').replace(/\s+/g, ' ').trim()
  const folder = isArchivSource(entry.source) ? 'Archiv' : 'Aktiv'
  return `${WISSEN_BASE}/${entry.category}/${folder}/${date}-${slug50(title)}.md`
}

function buildMarkdown(entry) {
  const date  = berlinDate(entry.created_at)
  const title = (entry.summary || (entry.raw_text || '').slice(0, 60) || 'Notiz').replace(/\s+/g, ' ').trim()
  const raw   = (entry.raw_text ?? '').length > 12000
    ? entry.raw_text.slice(0, 12000) + '\n\n[… gekürzt — Original in Supabase]'
    : entry.raw_text ?? ''
  return `---\nid: ${entry.id}\ncategory: ${entry.category}\nsource: ${entry.source}\ndate: ${date}\n---\n# ${title}\n\n${raw}`
}

// ── OpenAI embed ───────────────────────────────────────────────────────────────

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 6000) }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  return (await res.json()).data[0].embedding
}

// ── EXPORT ─────────────────────────────────────────────────────────────────────

async function runExport(manifest) {
  console.log(`\n=== EXPORT: Supabase → Obsidian ${DRY ? '(DRY-RUN)' : ''} ===`)

  const { data, error } = await sb
    .from('knowledge_entries')
    .select('id, category, summary, raw_text, tags, source, created_at')
    .is('storage_path', null)
    .in('category', [...EXPORT_CATEGORIES])
    .order('created_at')

  if (error) { console.error('❌ DB-Fehler:', error.message); return }

  let written = 0, skipped = 0

  for (const entry of data ?? []) {
    if ((entry.tags ?? []).includes('plan')) continue

    const relPath = entryVaultPath(entry)
    const absPath = path.join(VAULT, ...relPath.split('/'))

    manifest[entry.id] = relPath

    if (fs.existsSync(absPath) && !FORCE) { skipped++; continue }

    if (DRY) { console.log(`  [dry] ${relPath}`); written++; continue }

    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, buildMarkdown(entry), 'utf8')
    console.log(`  + ${relPath}`)
    written++
  }

  console.log(`Geschrieben: ${written}  Übersprungen (existiert): ${skipped}`)
}

// ── IMPORT ─────────────────────────────────────────────────────────────────────

async function runImport(manifest) {
  console.log(`\n=== IMPORT: Obsidian → Supabase ${DRY ? '(DRY-RUN)' : ''} ===`)

  if (!OPENAI_KEY) { console.error('❌ OPENAI_API_KEY fehlt — Import übersprungen'); return }

  const wissenAbs = path.join(VAULT, ...WISSEN_BASE.split('/'))
  if (!fs.existsSync(wissenAbs)) { console.log(`ℹ ${WISSEN_BASE} existiert noch nicht`); return }

  function scanDir(dir) {
    const files = []
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name)
      if (f.isDirectory()) files.push(...scanDir(full))
      else if (f.name.endsWith('.md')) files.push(full)
    }
    return files
  }

  const mdFiles = scanDir(wissenAbs)
  let created = 0, updated = 0, contextChanged = 0, unchanged = 0, errors = 0

  for (const absPath of mdFiles) {
    const content  = fs.readFileSync(absPath, 'utf8')
    const { meta, body } = parseFrontmatter(content)
    const rawText  = body.replace(/^#[^\n]*\n+/, '').trim()
    const relPath  = path.relative(VAULT, absPath).replace(/\\/g, '/')

    // Aktiv/ oder Archiv/ aus Pfad bestimmen
    const isAktiv  = relPath.includes('/Aktiv/')
    const isArchiv = relPath.includes('/Archiv/')
    const newContext = isAktiv ? true : isArchiv ? false : true

    // Kategorie aus Pfad ableiten (Literatur/Wissen/{Kategorie}/Aktiv/file.md)
    const parts    = relPath.split('/')
    const category = String(meta.category || parts[2] || 'Allgemein')

    if (meta.id) {
      const id = String(meta.id)

      // Aktuellen Zustand aus Supabase holen
      const { data: existing } = await sb
        .from('knowledge_entries')
        .select('content_hash, context')
        .eq('id', id)
        .single()

      const newHash     = md5(rawText)
      const hashChanged = !existing || existing.content_hash !== newHash
      const ctxChanged  = existing && existing.context !== newContext

      if (!hashChanged && !ctxChanged) { unchanged++; continue }

      if (DRY) {
        if (hashChanged) console.log(`  [dry] UPDATE Inhalt: ${path.basename(absPath)}`)
        if (ctxChanged)  console.log(`  [dry] UPDATE context=${newContext}: ${path.basename(absPath)}`)
        if (hashChanged) updated++; else contextChanged++
        continue
      }

      const updateData = { context: newContext }

      if (hashChanged) {
        try {
          updateData.embedding     = await embed(rawText)
          updateData.raw_text      = rawText
          updateData.content_hash  = newHash
        } catch (e) { console.error(`  ❌ Embed fehlgeschlagen: ${path.basename(absPath)}`, e.message); errors++; continue }
      }

      const { error } = await sb.from('knowledge_entries').update(updateData).eq('id', id)
      if (error) { console.error(`  ❌ Update fehlgeschlagen: ${id}`, error.message); errors++ }
      else {
        if (hashChanged) { console.log(`  ✏ Aktualisiert: ${path.basename(absPath)}`); updated++ }
        else             { console.log(`  🔀 context=${newContext}: ${path.basename(absPath)}`); contextChanged++ }
      }

    } else {
      // Neue Datei ohne id → in Supabase anlegen
      if (!rawText) continue
      if (DRY) { console.log(`  [dry] NEU: ${relPath}`); created++; continue }

      let embedding
      try { embedding = await embed(rawText) } catch (e) { console.error(`  ❌ Embed fehlgeschlagen:`, e.message); errors++; continue }

      const { data: newEntry, error } = await sb
        .from('knowledge_entries')
        .insert({ category, raw_text: rawText, source: String(meta.source || 'obsidian'), content_hash: md5(rawText), embedding, context: newContext })
        .select('id').single()

      if (error || !newEntry) { console.error(`  ❌ Insert fehlgeschlagen:`, error?.message); errors++; continue }

      // id in Frontmatter schreiben
      const newContent = content.replace(/^---\n/, `---\nid: ${newEntry.id}\n`)
      fs.writeFileSync(absPath, newContent, 'utf8')
      manifest[newEntry.id] = relPath
      console.log(`  + Neu: ${path.basename(absPath)} [${newEntry.id}]`)
      created++
    }
  }

  console.log(`Erstellt: ${created}  Inhalt geändert: ${updated}  Context geändert: ${contextChanged}  Unverändert: ${unchanged}  Fehler: ${errors}`)
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log(`\n🔄 wissen-sync ${DRY ? '(DRY-RUN) ' : ''}${FORCE ? '(FORCE) ' : ''}`)
console.log(`Vault: ${VAULT}`)

const manifest = loadManifest()
if (DO_EXPORT) await runExport(manifest)
if (DO_IMPORT) await runImport(manifest)
saveManifest(manifest)
console.log('\n✅ Fertig')

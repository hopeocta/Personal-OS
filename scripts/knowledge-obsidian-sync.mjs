// Knowledge → Obsidian Sync: spiegelt erfasste Wissensnotizen in ihre Kategorie-Ordner.
//
// Hintergrund: knowledge.ts schreibt Notizen (Telegram „Notiz/Lernen", Terminal „Erfassen",
// Chat-Sitzungen) per writeKnowledgeToObsidian in Kategorie-Ordner — das läuft aber auf Vercel
// (kein Zugriff auf lokales Obsidian). Dieser lokale Agent baut die fehlenden .md-Dateien nach.
//
// NICHT betroffen (von anderen Syncs/Quellen abgedeckt):
//   - Dokumente mit storage_path  → storage-obsidian-sync.mjs (Gesundheit/Verwaltung/Reisen)
//   - Pläne (tag 'plan')          → logbuch-sync.mjs (Reisen/Pläne, Pläne und Ideen/Projekte)
//   - Bücher (pdf-pipeline)       → reiner RAG-Text, keine Einzeldateien
//   - Briefings/Digests/Garmin    → logbuch-sync.mjs / garmin-obsidian-sync.mjs
//
// Aufruf:
//   node scripts/knowledge-obsidian-sync.mjs
//   node scripts/knowledge-obsidian-sync.mjs --dry-run
//   node scripts/knowledge-obsidian-sync.mjs --force      (vorhandene überschreiben)
//   node scripts/knowledge-obsidian-sync.mjs --days 90

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true, quiet: true })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Fehlende Env Vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const arg = (name, fb) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fb
}
const hasFlag = (n) => process.argv.includes(`--${n}`)

const VAULT = arg('vault', 'D:\\Obsidian Vault')
const DAYS = Math.max(1, parseInt(arg('days', '365'), 10))
const DRY = hasFlag('dry-run')
const FORCE = hasFlag('force')
const TZ = 'Europe/Berlin'

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Nur vom Nutzer erfasste Wissens-/Notiz-Quellen (keine Dokumente, keine System-Artefakte).
const KNOWLEDGE_SOURCES = ['telegram_note', 'telegram', 'chat_session']

// Kategorie → Vault-Ordner (synchron mit lib/obsidianPaths.ts CATEGORY_TO_FOLDER).
function folderForCategory(category) {
  const map = {
    Zahnmedizin: 'Literatur/Medizin/Zahnmedizin',
    Triathlon: 'Gesundheit/Recherche',
    Krafttraining: 'Gesundheit/Recherche',
    Ernährung: 'Gesundheit/Recherche',
    Musikproduktion: 'Musik',
    'FL Studio': 'Musik',
    Sampling: 'Musik',
    Allgemein: 'Recherche',
    Einkauf: 'Einkauf',
  }
  return map[category] ?? `Recherche/${category}`
}

const berlinDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d))
const slug50 = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50) || 'notiz'

const cutoffIso = new Date(Date.now() - DAYS * 86400000).toISOString()

console.log(`\n=== Knowledge → Obsidian Sync ${DRY ? '(DRY-RUN)' : ''} ===`)
console.log(`Vault: ${VAULT}  ·  Quellen: ${KNOWLEDGE_SOURCES.join(', ')}  ·  ${FORCE ? 'FORCE' : 'nur fehlende'}\n`)

const { data, error } = await sb
  .from('knowledge_entries')
  .select('created_at, category, summary, raw_text, tags, source, storage_path')
  .in('source', KNOWLEDGE_SOURCES)
  .is('storage_path', null)
  .gte('created_at', cutoffIso)
  .order('created_at')
if (error) { console.error('DB-Fehler:', error.message); process.exit(1) }

let written = 0, skipped = 0
const DOC_CATEGORIES = new Set(['Verwaltung', 'Gesundheit', 'Reisen'])

for (const e of data ?? []) {
  if ((e.tags ?? []).includes('plan')) continue          // Pläne → logbuch-sync
  if (DOC_CATEGORIES.has(e.category)) continue            // Dokumente → storage-obsidian-sync
  const category = e.category || 'Allgemein'
  const date = berlinDate(e.created_at)
  const title = (e.summary || (e.raw_text || '').slice(0, 60) || 'Notiz').replace(/\s+/g, ' ').trim()
  const rel = `${folderForCategory(category)}/${date}-${slug50(title)}.md`
  const abs = path.join(VAULT, ...rel.split('/'))

  if (fs.existsSync(abs) && !FORCE) { skipped++; continue }

  const content = `---\ndate: ${date}\ncategory: ${category}\nsource: ${e.source}\ntags: [${(e.tags ?? []).join(', ')}]\n---\n# ${title}\n\n${e.raw_text ?? ''}`
  if (DRY) { console.log(`  [dry] ${rel}`); written++; continue }
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf8')
  console.log(`  + ${rel}`)
  written++
}

console.log(`\n=== Fertig ${DRY ? '(DRY-RUN)' : ''} ===`)
console.log(`Geschrieben: ${written}   Übersprungen (existiert): ${skipped}`)

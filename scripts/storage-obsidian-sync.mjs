// Supabase Storage → Obsidian Sync
// Spiegelt neue Telegram-Uploads aus dem Storage-Bucket `documents` in den lokalen Vault.
// Für jede neue Datei: Original → Obsidian-Ordner + Index-.md-Notiz (aus health_labs rekonstruiert).
// Idempotent: bereits vorhandene Dateien werden übersprungen.
//
// Storage-Pfade:
//   gesundheit/{date}-{slug}.{ext}           → Gesundheit/Dokumente/
//   verwaltung/{Kat}/{date}-{slug}.{ext}     → Verwaltung/{Kat}/
//
// Aufruf:
//   node scripts/storage-obsidian-sync.mjs
//   node scripts/storage-obsidian-sync.mjs --dry-run
//   node scripts/storage-obsidian-sync.mjs --vault "D:\Obsidian Vault"

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

function argVal(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const hasFlag = (n) => process.argv.includes(`--${n}`)

const VAULT = argVal('vault', 'D:\\Obsidian Vault')
const DRY_RUN = hasFlag('dry-run')
const BUCKET = 'documents'

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Storage-Pfad → Obsidian-Pfad ──────────────────────────────────────────────

function storageToVaultRel(storagePath) {
  const parts = storagePath.split('/')
  if (parts[0] === 'gesundheit') return `Gesundheit/Dokumente/${parts.slice(1).join('/')}`
  if (parts[0] === 'verwaltung') return `Verwaltung/${parts.slice(1).join('/').replace('Universitaet', 'Universität')}`
  if (parts[0] === 'reisen') return `Reisen/Dokumente/${parts.slice(2).join('/')}` // reisen/dokumente/<file>
  return `Recherche/${storagePath}`
}

// ── Index-Notiz aufbauen ──────────────────────────────────────────────────────

async function buildGesundheitNote(storagePath, baseName, ext) {
  const { data: labs } = await sb
    .from('health_labs')
    .select('date, source_type, test_name, value, unit, reference_min, reference_max, status')
    .eq('storage_path', storagePath)
    .order('test_name')

  const date = labs?.[0]?.date ?? baseName.slice(0, 10)
  const docType = labs?.[0]?.source_type ?? 'befund'
  // Slug → lesbarer Titel (z.B. "blutbild-hausarzt" → "Blutbild hausarzt")
  const titleSlug = baseName.slice(11).replace(/-/g, ' ')
  const title = titleSlug.charAt(0).toUpperCase() + titleSlug.slice(1)

  let valueTable = ''
  if (labs && labs.length > 0) {
    const rows = labs
      .map((v) => {
        const ref =
          v.reference_min != null || v.reference_max != null
            ? `${v.reference_min ?? ''}–${v.reference_max ?? ''}`
            : ''
        const statusIcon = v.status === 'low' ? '🔽' : v.status === 'high' ? '🔼' : v.status === 'normal' ? '✅' : '•'
        return `| ${v.test_name} | ${v.value ?? ''} ${v.unit ?? ''} | ${ref} | ${statusIcon} ${v.status} |`
      })
      .join('\n')
    valueTable = `\n## Werte\n\n| Wert | Ergebnis | Referenz | Status |\n|---|---|---|---|\n${rows}\n`
  }

  return `---
date: ${date}
category: Gesundheit
doc_type: ${docType}
source: telegram
storage_path: ${storagePath}
---
# ${title}

![[${baseName}.${ext}]]
${valueTable}`
}

function buildVerwaltungNote(storagePath, baseName, ext, kategorie) {
  const date = baseName.slice(0, 10)
  const titleSlug = baseName.slice(11).replace(/-/g, ' ')
  const title = titleSlug.charAt(0).toUpperCase() + titleSlug.slice(1)

  return `---
date: ${date}
category: Verwaltung
kategorie: ${kategorie}
source: telegram
storage_path: ${storagePath}
---
# ${title}

![[${baseName}.${ext}]]
`
}

function buildReisenNote(storagePath, baseName, ext) {
  const date = baseName.slice(0, 10)
  const titleSlug = baseName.slice(11).replace(/-/g, ' ')
  const title = titleSlug.charAt(0).toUpperCase() + titleSlug.slice(1)

  return `---
date: ${date}
category: Reisen
source: telegram
storage_path: ${storagePath}
---
# ${title}

![[${baseName}.${ext}]]
`
}

// ── Storage-Ordner listen ─────────────────────────────────────────────────────

async function listItems(prefix) {
  const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) {
    console.error(`  [storage] list error (${prefix}):`, error.message)
    return []
  }
  return data ?? []
}

// id !== null → echte Datei; id === null → Ordner-Platzhalter
const isFile = (item) => item.id !== null

// ── Hauptlauf ─────────────────────────────────────────────────────────────────

console.log(`\n=== Storage → Obsidian Sync ===`)
console.log(`Vault: ${VAULT}  ${DRY_RUN ? '(DRY-RUN)' : ''}`)

let synced = 0
let skipped = 0
let errors = 0

async function syncFile(storagePath, buildNote) {
  const vaultRel = storageToVaultRel(storagePath)
  const absPath = path.join(VAULT, ...vaultRel.split('/'))

  if (fs.existsSync(absPath)) {
    skipped++
    return
  }

  const ext = path.extname(storagePath).slice(1)
  const baseName = path.basename(storagePath, `.${ext}`)
  console.log(`  + ${storagePath}  →  ${vaultRel}`)

  if (DRY_RUN) { synced++; return }

  try {
    const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(storagePath)
    if (dlErr || !blob) throw new Error(dlErr?.message ?? 'Download fehlgeschlagen')
    const buffer = Buffer.from(await blob.arrayBuffer())

    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, buffer)

    const note = await buildNote(storagePath, baseName, ext)
    const mdPath = absPath.replace(/\.[^.]+$/, '.md')
    if (!fs.existsSync(mdPath)) fs.writeFileSync(mdPath, note, 'utf8')

    synced++
    console.log(`  ✓`)
  } catch (e) {
    errors++
    console.error(`  ✗ ${e.message}`)
  }
}

// 1. gesundheit/
const gesItems = (await listItems('gesundheit')).filter(isFile)
console.log(`\ngesundheit/: ${gesItems.length} Datei(en)`)
for (const f of gesItems) {
  await syncFile(`gesundheit/${f.name}`, buildGesundheitNote)
}

// 2. verwaltung/{Kat}/[Unterordner/]…  — rekursiv (z.B. Finanzen/Rechnungen privat/)
async function syncVerwaltungDir(prefix, kat) {
  const items = await listItems(prefix)
  for (const item of items) {
    const full = `${prefix}/${item.name}`
    if (isFile(item)) {
      await syncFile(full, (sp, bn, ex) => Promise.resolve(buildVerwaltungNote(sp, bn, ex, kat ?? 'Sonstiges')))
    } else {
      // erste Ordner-Ebene unter verwaltung/ = Kategorie
      await syncVerwaltungDir(full, kat ?? item.name)
    }
  }
}
console.log(`verwaltung/: rekursiv`)
await syncVerwaltungDir('verwaltung', null)

// 3. reisen/dokumente/ → Reisen/Dokumente/
const reiseItems = (await listItems('reisen/dokumente')).filter(isFile)
console.log(`reisen/dokumente/: ${reiseItems.length} Datei(en)`)
for (const f of reiseItems) {
  await syncFile(`reisen/dokumente/${f.name}`, (sp, bn, ex) => Promise.resolve(buildReisenNote(sp, bn, ex)))
}

console.log(`\n=== Fertig ===  neu: ${synced}  übersprungen: ${skipped}  Fehler: ${errors}`)
if (errors > 0) process.exit(1)

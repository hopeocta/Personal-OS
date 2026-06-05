// Supabase Storage → Obsidian Vault Sync
//
// Holt alle Verwaltung- und Gesundheit-Dokumente aus Supabase Storage
// und schreibt fehlende Dateien in den Obsidian-Vault.
// Läuft lokal auf dem PC (Obsidian REST API = localhost:27123).
//
// Aufruf:
//   node scripts/supabase-to-obsidian.mjs
//   node scripts/supabase-to-obsidian.mjs --dry-run    (nur zeigen was fehlt)
//   node scripts/supabase-to-obsidian.mjs --force      (alle überschreiben)
//
// Autostart via Windows Task Scheduler:
//   Trigger: bei Benutzeranmeldung, Verzögerung 30s
//   Aktion:  node "C:\Pfad\zum\Projekt\scripts\supabase-to-obsidian.mjs"

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true })
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OBSIDIAN_URL = process.env.OBSIDIAN_API_URL ?? 'http://localhost:27123'
const OBSIDIAN_KEY = process.env.OBSIDIAN_API_KEY

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Fehlende Env Vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!OBSIDIAN_KEY) {
  console.error('❌ Fehlende Env Var: OBSIDIAN_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Obsidian-Helfer ────────────────────────────────────────────────────────────

async function obsidianExists(vaultPath) {
  const encoded = vaultPath.split('/').map(encodeURIComponent).join('/')
  try {
    const res = await fetch(`${OBSIDIAN_URL}/vault/${encoded}`, {
      headers: { Authorization: `Bearer ${OBSIDIAN_KEY}` },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return null // null = Obsidian nicht erreichbar
  }
}

async function obsidianWrite(vaultPath, buffer, mimeType) {
  const encoded = vaultPath.split('/').map(encodeURIComponent).join('/')
  const res = await fetch(`${OBSIDIAN_URL}/vault/${encoded}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${OBSIDIAN_KEY}`, 'Content-Type': mimeType },
    body: buffer,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Obsidian PUT failed: ${res.status}`)
}

// ── MIME-Typ aus Dateiendung ───────────────────────────────────────────────────

function mimeFromExt(ext) {
  const map = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    txt: 'text/plain',
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}

// ── Storage-Pfad → Vault-Pfad ──────────────────────────────────────────────────
// storage: "verwaltung/Finanzen/2026-06-04-rechnung.pdf"
// vault:   "Verwaltung/Finanzen/2026-06-04-rechnung.pdf"
//
// storage: "gesundheit/2026-06-04-blutbild.pdf"
// vault:   "Gesundheit/Dokumente/2026-06-04-blutbild.pdf"

function storageToVaultPath(storagePath) {
  if (storagePath.startsWith('verwaltung/')) {
    // "verwaltung/X/Y" → "Verwaltung/X/Y" (Storage-ASCII 'Universitaet' → Vault-Umlaut 'Universität')
    return ('V' + storagePath.slice(1)).replace('Universitaet', 'Universität')
  }
  if (storagePath.startsWith('reisen/dokumente/')) {
    // "reisen/dokumente/X" → "Reisen/Dokumente/X"
    return 'Reisen/Dokumente/' + storagePath.slice('reisen/dokumente/'.length)
  }
  if (storagePath.startsWith('gesundheit/')) {
    const rest = storagePath.slice('gesundheit/'.length)
    // Falls schon "Dokumente/" drin: unverändert lassen
    if (rest.startsWith('Dokumente/')) {
      return `Gesundheit/${rest}`
    }
    return `Gesundheit/Dokumente/${rest}`
  }
  return storagePath
}

// ── Obsidian erreichbar? ───────────────────────────────────────────────────────

async function waitForObsidian(maxWaitMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${OBSIDIAN_URL}/`, {
        headers: { Authorization: `Bearer ${OBSIDIAN_KEY}` },
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok || res.status === 404) return true
    } catch {
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 3000))
    process.stdout.write('.')
  }
  return false
}

// ── Hauptlogik ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Supabase → Obsidian Sync')
  if (DRY_RUN) console.log('   (Dry-run — keine Änderungen)')

  // Obsidian erreichbar?
  process.stdout.write('⏳ Warte auf Obsidian REST API')
  const ready = await waitForObsidian(60000)
  console.log()
  if (!ready) {
    console.error('❌ Obsidian nicht erreichbar nach 60s — ist Obsidian offen und der Local REST API Plugin aktiv?')
    process.exit(1)
  }
  console.log('✅ Obsidian bereit\n')

  // Alle Verwaltung + Gesundheit Einträge mit storage_path laden
  const { data, error } = await supabase
    .from('knowledge_entries')
    .select('id, summary, category, storage_path')
    .in('category', ['Verwaltung', 'Gesundheit'])
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: true })

  if (error) { console.error('❌ Supabase Fehler:', error); process.exit(1) }

  const entries = (data ?? []).filter((e) => e.storage_path)
  console.log(`📋 ${entries.length} Dokumente in Supabase (Verwaltung + Gesundheit)\n`)

  let synced = 0, skipped = 0, failed = 0

  for (const entry of entries) {
    const vaultPath = storageToVaultPath(entry.storage_path)
    const ext = entry.storage_path.split('.').pop() ?? 'bin'
    const label = `${entry.summary?.slice(0, 50) ?? entry.storage_path}`

    // Schon in Obsidian?
    if (!FORCE) {
      const exists = await obsidianExists(vaultPath)
      if (exists === null) {
        console.error('❌ Obsidian nicht mehr erreichbar — Abbruch.')
        break
      }
      if (exists) {
        skipped++
        continue
      }
    }

    if (DRY_RUN) {
      console.log(`  → würde sync: ${vaultPath}`)
      synced++
      continue
    }

    // Signed URL erstellen und herunterladen
    const { data: signed, error: signErr } = await supabase.storage
      .from('documents')
      .createSignedUrl(entry.storage_path, 120)

    if (signErr || !signed?.signedUrl) {
      console.error(`  ❌ Signed URL fehlgeschlagen für ${entry.storage_path}:`, signErr)
      failed++
      continue
    }

    let buffer
    try {
      const res = await fetch(signed.signedUrl, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      buffer = Buffer.from(await res.arrayBuffer())
    } catch (err) {
      console.error(`  ❌ Download fehlgeschlagen: ${label}:`, err.message)
      failed++
      continue
    }

    // In Obsidian schreiben
    try {
      await obsidianWrite(vaultPath, buffer, mimeFromExt(ext))
      console.log(`  ✅ ${label}`)
      synced++
    } catch (err) {
      console.error(`  ❌ Obsidian-Schreiben fehlgeschlagen: ${label}:`, err.message)
      failed++
    }
  }

  console.log(`\n📊 Fertig: ${synced} synchronisiert, ${skipped} bereits vorhanden, ${failed} Fehler`)
}

main().catch((err) => { console.error('❌ Unerwarteter Fehler:', err); process.exit(1) })

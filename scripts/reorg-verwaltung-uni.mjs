// EINMALIGES Cleanup: Verwaltung-Reorg → neuer Ordner "Universität".
//
// 1. 6 LMU-Kursscheine (aus Amt/Datenbank) → Universität, mit KORRIGIERTEN
//    Titeln/Summaries/Dateinamen (Haiku hatte sie falsch klassifiziert).
// 2. 3 Erasmus-Docs (aus Arbeit) → Universität, Namen bleiben (Summaries korrekt).
// 3. Ghost-DB-Eintrag (durch Dateinamen-Kollision überschriebenes PDF) löschen.
//
// Pro Doc: Vault-PDF + .md verschieben, Storage-Objekt verschieben, DB-Row aktualisieren.
// Bei korrigierten Docs: embedding=null setzen → embed-backfill.mjs heilt RAG.
//
// Aufruf:  node scripts/reorg-verwaltung-uni.mjs
//          node scripts/reorg-verwaltung-uni.mjs --dry-run

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

const DRY = process.argv.includes('--dry-run')
const VAULT = 'D:\\Obsidian Vault'
const BUCKET = 'documents'
const NEW_FOLDER = 'Universität' // Vault-Ordnername (mit ü)
const NEW_STORAGE_PREFIX = 'verwaltung/Universitaet' // Storage-Key ASCII-sicher

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── 6 Kursscheine mit korrigiertem Inhalt (echter PDF-Inhalt, von mir gelesen) ──
const FIX = [
  {
    id: '66c65f74-089f-4432-97b5-f0d97c927c73',
    oldFolder: 'Amt',
    oldBase: '2026-06-05-lmu-muenchen-bescheinigung-zahlungszugang',
    date: '2022-09-09',
    slug: 'lmu-phantomkurs-zahnersatzkunde-2',
    title: 'LMU Kursschein – Phantomkurs Zahnersatzkunde II',
    summary:
      'Bescheinigung der Ludwig-Maximilians-Universität München über die erfolgreiche Teilnahme von Christoph Hoffmann (geb. 19.03.1999) am Phantomkurs der Zahnersatzkunde II, Poliklinik für Zahnärztliche Prothetik, Sommerhalbjahr 01.08.2022 bis 09.09.2022. Ausgestellt am 09.09.2022.',
    tags: ['universität', 'kursschein', 'zahnersatzkunde', 'zahnmedizin', 'lmu münchen'],
  },
  {
    id: '5eecf449-5139-467a-995a-5f50e9cb4140',
    oldFolder: 'Amt',
    oldBase: '2026-06-05-ludwig-maximilians-universitaet-bescheinigung',
    date: '2021-07-16',
    slug: 'lmu-phantomkurs-zahnersatzkunde-1',
    title: 'LMU Kursschein – Phantomkurs Zahnersatzkunde I',
    summary:
      'Bescheinigung der Ludwig-Maximilians-Universität München über die erfolgreiche Teilnahme von Christoph Hoffmann (geb. 19.03.1999) am Phantomkurs der Zahnersatzkunde I, Poliklinik für Zahnärztliche Prothetik, 12.04.2021 bis 16.07.2021. Ausgestellt am 16.07.2021.',
    tags: ['universität', 'kursschein', 'zahnersatzkunde', 'zahnmedizin', 'lmu münchen'],
  },
  {
    id: '378c733a-7dda-4d6f-a76a-40088022fc50',
    oldFolder: 'Amt',
    oldBase: '2026-06-05-ludwig-maximilians-universitaet-muenchen-bescheini',
    date: '2021-07-16',
    slug: 'lmu-praktikum-physik-zahnmedizin',
    title: 'LMU Kursschein – Praktikum Physik für Zahnmediziner',
    summary:
      'Bescheinigung der Ludwig-Maximilians-Universität München über die erfolgreiche Teilnahme von Christoph Hoffmann (geb. 19.03.1999) am Praktikum der Physik für Studierende der Zahnmedizin, Sektion Physik, 12.04.2021 bis 16.07.2021. Ausgestellt am 16.07.2021.',
    tags: ['universität', 'kursschein', 'physik', 'zahnmedizin', 'lmu münchen'],
  },
  {
    id: '9c37df9a-b9b3-4e58-b6cf-ff7c9f90973a',
    oldFolder: 'Datenbank',
    oldBase: '2026-06-05-lmu-muenchen-zahnmedizin-bescheinigung',
    date: '2021-04-17',
    slug: 'lmu-chemisches-praktikum-zahnmedizin',
    title: 'LMU Kursschein – Chemisches Praktikum für Zahnmediziner',
    summary:
      'Bescheinigung der Ludwig-Maximilians-Universität München über die erfolgreiche Teilnahme von Christoph Hoffmann (geb. 19.03.1999) am Chemischen Praktikum für Zahnmediziner, Institut für Organische Chemie, 02.11.2020 bis 12.02.2021. Ausgestellt am 17.04.2021.',
    tags: ['universität', 'kursschein', 'chemie', 'zahnmedizin', 'lmu münchen'],
  },
  {
    id: 'd817b308-4577-42b6-bfcf-028f8e5282cd',
    oldFolder: 'Datenbank',
    oldBase: '2026-06-05-ludwig-maximilians-universitaet-muenchen-bescheini',
    date: '2021-02-12',
    slug: 'lmu-technische-propaedeutik',
    title: 'LMU Kursschein – Kursus der technischen Propädeutik',
    summary:
      'Bescheinigung der Ludwig-Maximilians-Universität München über die erfolgreiche Teilnahme von Christoph Hoffmann (geb. 19.03.1999) am Kursus der technischen Propädeutik, Poliklinik für Zahnärztliche Prothetik, 02.11.2020 bis 12.02.2021. Ausgestellt am 12.02.2021.',
    tags: ['universität', 'kursschein', 'propädeutik', 'zahnmedizin', 'lmu münchen'],
  },
  {
    id: '9ea16020-6d85-489d-9a02-751c8012d7f2',
    oldFolder: 'Datenbank',
    oldBase: '2026-06-05-teilnahmebescheinigung-zahnmedizin-praktikum',
    date: '2022-07-29',
    slug: 'lmu-physiologisch-chemisches-praktikum',
    title: 'LMU Kursschein – Physiologisch-chemisches Praktikum',
    summary:
      'Bescheinigung der Ludwig-Maximilians-Universität München über die erfolgreiche Teilnahme von Christoph Hoffmann (geb. 19.03.1999) am Physiologisch-chemischen Praktikum für Studierende der Zahnmedizin, Physiologische Chemie, 25.04.2022 bis 29.07.2022. Ausgestellt am 29.07.2022.',
    tags: ['universität', 'kursschein', 'physiologische chemie', 'zahnmedizin', 'lmu münchen'],
  },
]

// ── 3 Erasmus-Docs: nur verschieben, Inhalt korrekt ────────────────────────────
const MOVE = [
  { id: 'f1c53bee-fee3-406e-92e4-0ed2e40da9d0', oldFolder: 'Arbeit', base: '2023-12-14-erasmus-learning-agreement-zahnmedizin-2023-2024' },
  { id: '85b4102e-77b0-4ff2-8431-4095151269a6', oldFolder: 'Arbeit', base: '2024-04-23-sicherheitsschulung-arbeiter-attestat-2024' },
  { id: '06fc6d73-4fbb-4d1a-b784-d1ab3e8ca674', oldFolder: 'Arbeit', base: '2024-06-24-erasmusstudienbescheinigungpalermo2024' },
]

const GHOST_ID = 'ee8308d6-b44c-4718-a691-cd79b060cc41' // überschriebenes "Februar 2022"-PDF

function vaultPath(folder, file) {
  return path.join(VAULT, 'Verwaltung', folder, file)
}
function moveVault(src, dst) {
  if (!fs.existsSync(src)) { console.warn(`    ⚠ Vault-Quelle fehlt: ${src}`); return false }
  if (DRY) { console.log(`    [dry] mv ${src} → ${dst}`); return true }
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.renameSync(src, dst)
  return true
}
async function moveStorage(from, to) {
  if (DRY) { console.log(`    [dry] storage mv ${from} → ${to}`); return }
  const { error } = await sb.storage.from(BUCKET).move(from, to)
  if (error) console.warn(`    ⚠ Storage-Move (${from}): ${error.message}`)
  else console.log(`    ⬆ Storage → ${to}`)
}

const newDir = path.join(VAULT, 'Verwaltung', NEW_FOLDER)
if (!DRY) fs.mkdirSync(newDir, { recursive: true })

console.log(`\n=== Verwaltung → Universität Reorg ${DRY ? '(DRY-RUN)' : ''} ===\n`)

// 1) Kursscheine korrigieren + verschieben
for (const d of FIX) {
  const newBase = `${d.date}-${d.slug}`
  console.log(`• [FIX] ${d.oldFolder}/${d.oldBase}  →  ${NEW_FOLDER}/${newBase}`)

  moveVault(vaultPath(d.oldFolder, `${d.oldBase}.pdf`), path.join(newDir, `${newBase}.pdf`))

  // .md neu schreiben (korrekter Titel/Summary + Embed-Link), alte .md löschen
  const note = `---\ndate: ${d.date}\ncategory: Verwaltung\nsource: eingang\ntags: [${d.tags.join(', ')}]\n---\n# ${d.title}\n\n${d.summary}\n\n![[${newBase}.pdf]]\n`
  const oldMd = vaultPath(d.oldFolder, `${d.oldBase}.md`)
  if (DRY) {
    console.log(`    [dry] write ${newBase}.md, rm ${oldMd}`)
  } else {
    fs.writeFileSync(path.join(newDir, `${newBase}.md`), note, 'utf8')
    if (fs.existsSync(oldMd)) fs.unlinkSync(oldMd)
  }

  await moveStorage(`verwaltung/${d.oldFolder}/${d.oldBase}.pdf`, `${NEW_STORAGE_PREFIX}/${newBase}.pdf`)

  if (DRY) {
    console.log(`    [dry] DB update ${d.id}: summary + storage_path + embedding=null`)
  } else {
    const { error } = await sb
      .from('knowledge_entries')
      .update({
        summary: d.summary,
        raw_text: d.summary,
        tags: d.tags,
        storage_path: `${NEW_STORAGE_PREFIX}/${newBase}.pdf`,
        embedding: null, // → embed-backfill.mjs heilt RAG
      })
      .eq('id', d.id)
    if (error) console.warn(`    ⚠ DB-Update: ${error.message}`)
    else console.log(`    ✓ DB aktualisiert (embedding genullt → backfill)`)
  }
}

// 2) Erasmus-Docs nur verschieben
for (const m of MOVE) {
  console.log(`• [MOVE] ${m.oldFolder}/${m.base}`)
  moveVault(vaultPath(m.oldFolder, `${m.base}.pdf`), path.join(newDir, `${m.base}.pdf`))
  moveVault(vaultPath(m.oldFolder, `${m.base}.md`), path.join(newDir, `${m.base}.md`))
  await moveStorage(`verwaltung/${m.oldFolder}/${m.base}.pdf`, `${NEW_STORAGE_PREFIX}/${m.base}.pdf`)
  if (DRY) {
    console.log(`    [dry] DB update ${m.id}: storage_path`)
  } else {
    const { error } = await sb
      .from('knowledge_entries')
      .update({ storage_path: `${NEW_STORAGE_PREFIX}/${m.base}.pdf` })
      .eq('id', m.id)
    if (error) console.warn(`    ⚠ DB-Update: ${error.message}`)
    else console.log(`    ✓ DB storage_path aktualisiert`)
  }
}

// 3) Ghost-Eintrag löschen (PDF wurde durch Kollision überschrieben; Foto wird neu eingelesen)
console.log(`• [GHOST] DB-Eintrag ${GHOST_ID} löschen (kollidiertes "Februar 2022"-PDF)`)
if (DRY) {
  console.log(`    [dry] delete knowledge_entries ${GHOST_ID}`)
} else {
  const { error } = await sb.from('knowledge_entries').delete().eq('id', GHOST_ID)
  if (error) console.warn(`    ⚠ Ghost-Delete: ${error.message}`)
  else console.log(`    ✓ Ghost-Eintrag entfernt`)
}

console.log(`\n=== Fertig ${DRY ? '(DRY-RUN — nichts verändert)' : ''} ===`)
console.log(DRY ? '' : 'Jetzt ausführen:  node scripts/embed-backfill.mjs   (re-embeddet die 6 korrigierten)\n')

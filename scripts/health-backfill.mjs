// Backfill: macht ALLE bereits im Supabase-Storage-Tresor liegenden Dokumente
// (gesundheit/… und verwaltung/…) nachträglich per Frage abfragbar.
//
// Tresor = Quelle der Wahrheit. Mit --reset (Standard) werden vorhandene
// dokument-abgeleitete Einträge zuerst gelöscht und sauber neu aufgebaut:
//   - knowledge_entries mit source in (telegram_gesundheit, telegram_verwaltung, doc_backfill)
//   - health_labs (alle Zeilen von user_id='me' — stammen ausschließlich aus Storage-Dokumenten)
// Danach wird jedes Original neu eingelesen → Claude extrahiert → knowledge_entries
// (+ Embedding) und für Gesundheit zusätzlich health_labs. Idempotent (re-runnable).
//
// Voraussetzung: .env.local mit ANTHROPIC_API_KEY, OPENAI_API_KEY,
//                NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Aufruf:
//   node scripts/health-backfill.mjs            (Reset + Neuaufbau)
//   node scripts/health-backfill.mjs --dry-run  (nur klassifizieren + zeigen, nichts schreiben)
//   node scripts/health-backfill.mjs --no-reset (nur fehlende ergänzen, nicht löschen)

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'

dotenv.config({ path: '.env.local', override: true, quiet: true })

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMBED_MODEL = 'text-embedding-3-small'
const STORAGE_BUCKET = 'documents'

if (!ANTHROPIC_API_KEY || !OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Fehlende Env Vars: ANTHROPIC_API_KEY, OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const hasFlag = (n) => process.argv.includes(`--${n}`)
const DRY_RUN = hasFlag('dry-run')
const RESET = !hasFlag('no-reset')

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// ── Prompts (synchron zu lib/healthDocs.ts) ──────────────────────────────────
const GESUNDHEIT_SYSTEM = `Du bist ein medizinischer Dokumenten-Parser fuer ein persoenliches Gesundheits-Archiv.
Du bekommst ein Bild oder PDF: entweder ein Blutbild/Laborbefund, eine Leistungsdiagnostik (Laktattest/Spiroergometrie/Ergometer) oder einen sonstigen Arztbefund/Termin.

Gib AUSSCHLIESSLICH valides JSON zurueck, keine Erklaerung, kein Markdown:
{
  "doc_type": "blutbild" | "laktattest" | "befund",
  "title": "kurzer deutscher Titel, max 60 Zeichen",
  "summary": "1-2 Saetze deutsche Zusammenfassung des Dokuments",
  "values": [
    { "test_name": "Name des Wertes", "value": Zahl oder null, "unit": "Einheit oder null", "reference_min": Zahl oder null, "reference_max": Zahl oder null, "status": "normal"|"low"|"high"|"unknown" }
  ]
}

Regeln:
- doc_type "blutbild" fuer Laborwerte/Blutbild, "laktattest" fuer Leistungsdiagnostik (auch Ergometer/Spiroergometrie), "befund" fuer alles andere.
- Extrahiere JEDEN messbaren Wert. Status: unter Min = "low", ueber Max = "high", sonst "normal". Kein Referenzbereich = "unknown".
- Keine messbaren Werte (reiner Termin/Text): "values": [] und doc_type "befund".
- Zahlen als echte JSON-Zahlen (Punkt als Dezimaltrenner), nicht als String.`

const VERWALTUNG_SYSTEM = `Du sortierst offizielle/buerokratische Dokumente in ein Archiv ein.
Du bekommst ein Bild oder PDF. Bestimme die Ablage und fasse den Inhalt KURZ zusammen.

Gib AUSSCHLIESSLICH valides JSON zurueck:
{
  "kategorie": "Versicherung" | "Arbeit" | "Amt" | "Finanzen" | "Wohnen" | "Datenbank" | "Sonstiges",
  "title": "kurzer deutscher Titel, max 60 Zeichen",
  "summary": "1-2 Saetze: worum geht es, wichtigste Eckdaten (Namen, Datum, Betraege, Nummern)"
}`

// ── Helfer ───────────────────────────────────────────────────────────────────
function parseClaudeJson(raw) {
  try {
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch (e) {
    console.error('  JSON-Parse-Fehler:', e.message, '-', raw.slice(0, 120))
    return null
  }
}

function extFromName(name) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

function kindFromExt(ext) {
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
  return 'other'
}

function imgMediaType(ext) {
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

function dateFromName(name) {
  const base = name.split('/').pop() ?? name
  const m = base.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}

function fileBlock(buffer, ext, kind) {
  const data = buffer.toString('base64')
  if (kind === 'pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
  }
  return { type: 'image', source: { type: 'base64', media_type: imgMediaType(ext), data } }
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

async function insertKnowledge({ rawText, category, summary, tags, source, contentHash }) {
  const { data, error } = await sb
    .from('knowledge_entries')
    .insert({ raw_text: rawText, category, summary, tags, source, user_id: 'me', content_hash: contentHash ?? null })
    .select('id')
    .single()
  if (error) throw new Error(`knowledge_entries insert: ${error.message}`)
  try {
    const vec = await embed(`${summary}\n\n${rawText}`)
    const { error: embErr } = await sb.from('knowledge_entries').update({ embedding: vec }).eq('id', data.id)
    if (embErr) console.warn(`  ⚠ Embedding-Update: ${embErr.message}`)
  } catch (e) {
    console.warn(`  ⚠ Embedding fehlgeschlagen: ${e.message}`)
  }
}

// Rekursiv alle Dateien unter einem Prefix listen (verwaltung/ hat Unterordner).
async function listAll(prefix) {
  const out = []
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).list(prefix, { limit: 1000 })
  if (error) throw new Error(`storage list ${prefix}: ${error.message}`)
  for (const entry of data ?? []) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.id === null) {
      out.push(...(await listAll(full))) // Ordner → rekursiv
    } else {
      out.push(full)
    }
  }
  return out
}

// ── Verarbeitung pro Dokument ────────────────────────────────────────────────
async function processGesundheit(path, buffer, ext, kind, dateIso) {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192, // grosse Labor-/Diagnostik-Dokumente: sonst JSON-Abbruch → Werte weg
    system: GESUNDHEIT_SYSTEM,
    messages: [{ role: 'user', content: [fileBlock(buffer, ext, kind), { type: 'text', text: 'Analysiere dieses Gesundheitsdokument.' }] }],
  })
  const tb = msg.content.find((c) => c.type === 'text')
  const a = tb ? parseClaudeJson(tb.text) : null
  const docType = a?.doc_type ?? 'befund'
  const title = (a?.title || 'Befund').trim().slice(0, 60)
  const summary = (a?.summary || '').trim()
  const values = Array.isArray(a?.values) ? a.values : []

  console.log(`  → gesundheit/${docType}: "${title}" — ${values.length} Werte`)
  if (DRY_RUN) return { values: values.length }

  if (values.length > 0) {
    const rows = values.map((v) => ({
      user_id: 'me',
      date: dateIso,
      source_type: docType,
      test_name: String(v.test_name ?? '').slice(0, 200),
      value: typeof v.value === 'number' ? v.value : null,
      unit: v.unit ?? null,
      reference_min: typeof v.reference_min === 'number' ? v.reference_min : null,
      reference_max: typeof v.reference_max === 'number' ? v.reference_max : null,
      status: v.status ?? 'unknown',
      storage_path: path,
    }))
    const { error } = await sb.from('health_labs').insert(rows)
    if (error) console.warn(`  ⚠ health_labs insert: ${error.message}`)
  }

  const valuesText = values
    .map((v) => {
      const ref = v.reference_min != null || v.reference_max != null ? ` (Ref ${v.reference_min ?? ''}–${v.reference_max ?? ''})` : ''
      return `${v.test_name}: ${v.value ?? ''} ${v.unit ?? ''}${ref} [${v.status ?? 'unknown'}]`
    })
    .join('\n')
  const rawText = [`${title} (${docType}, ${dateIso})`, summary, valuesText].filter(Boolean).join('\n\n')
  const contentHash = createHash('sha256').update(new Uint8Array(buffer)).digest('hex')
  await insertKnowledge({ rawText, category: 'Gesundheit', summary: summary || title, tags: [docType, 'gesundheit'], source: 'doc_backfill', contentHash })
  return { values: values.length }
}

async function processVerwaltung(path, buffer, ext, kind, dateIso) {
  const kategorieFromPath = path.split('/')[1] || 'Sonstiges'
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: VERWALTUNG_SYSTEM,
    messages: [{ role: 'user', content: [fileBlock(buffer, ext, kind), { type: 'text', text: 'Ordne dieses Dokument ein.' }] }],
  })
  const tb = msg.content.find((c) => c.type === 'text')
  const a = tb ? parseClaudeJson(tb.text) : null
  const kategorie = (a?.kategorie || kategorieFromPath).trim()
  const title = (a?.title || 'Dokument').trim().slice(0, 60)
  const summary = (a?.summary || '').trim()

  console.log(`  → verwaltung/${kategorie}: "${title}"`)
  if (DRY_RUN) return { values: 0 }

  const rawText = [`${title} (Verwaltung/${kategorie}, ${dateIso})`, summary].filter(Boolean).join('\n\n')
  const contentHash = createHash('sha256').update(new Uint8Array(buffer)).digest('hex')
  await insertKnowledge({ rawText, category: 'Verwaltung', summary: summary || title, tags: [kategorie.toLowerCase(), 'verwaltung'], source: 'doc_backfill', contentHash })
  return { values: 0 }
}

// ── Hauptlauf ─────────────────────────────────────────────────────────────────
console.log(`\n=== Health/Document Backfill ===`)
console.log(`Modus: ${DRY_RUN ? 'DRY-RUN (nichts wird geschrieben)' : RESET ? 'RESET + Neuaufbau' : 'nur ergänzen (--no-reset)'}\n`)

const gesundheit = await listAll('gesundheit')
const verwaltung = await listAll('verwaltung')
const all = [...gesundheit.map((p) => ({ p, area: 'gesundheit' })), ...verwaltung.map((p) => ({ p, area: 'verwaltung' }))]
console.log(`Tresor: ${gesundheit.length} Gesundheit + ${verwaltung.length} Verwaltung = ${all.length} Dokumente\n`)

if (RESET && !DRY_RUN) {
  console.log('Reset: lösche dokument-abgeleitete Einträge…')
  const { error: kErr } = await sb.from('knowledge_entries').delete().in('source', ['telegram_gesundheit', 'telegram_verwaltung', 'doc_backfill'])
  if (kErr) console.warn(`  ⚠ knowledge_entries delete: ${kErr.message}`)
  const { error: hErr } = await sb.from('health_labs').delete().eq('user_id', 'me')
  if (hErr) console.warn(`  ⚠ health_labs delete: ${hErr.message}`)
  console.log('  ✓ alte Einträge entfernt\n')
}

let done = 0
let totalValues = 0
const errors = []

for (const { p, area } of all) {
  const ext = extFromName(p)
  const kind = kindFromExt(ext)
  if (kind === 'other') {
    console.log(`• ${p}  [übersprungen: ${ext || 'kein'} Format]`)
    continue
  }
  console.log(`• ${p}  [${kind}]`)
  try {
    const { data: blob, error } = await sb.storage.from(STORAGE_BUCKET).download(p)
    if (error || !blob) throw new Error(`download: ${error?.message ?? 'leer'}`)
    const buffer = Buffer.from(await blob.arrayBuffer())
    const dateIso = dateFromName(p)
    const res = area === 'gesundheit'
      ? await processGesundheit(p, buffer, ext, kind, dateIso)
      : await processVerwaltung(p, buffer, ext, kind, dateIso)
    totalValues += res.values
    done++
  } catch (e) {
    errors.push(`${p}: ${e.message}`)
    console.warn(`  ✗ ${e.message}`)
  }
}

console.log(`\n=== Fertig ===`)
console.log(`${DRY_RUN ? 'Würde verarbeiten' : 'Verarbeitet'}: ${done}/${all.length}   Werte (health_labs): ${totalValues}   Fehler: ${errors.length}`)
if (errors.length) for (const e of errors.slice(0, 10)) console.log(`  - ${e}`)

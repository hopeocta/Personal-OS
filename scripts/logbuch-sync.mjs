// Logbuch-Sync: baut das Obsidian-Logbuch aus Supabase (Quelle der Wahrheit) nach.
//
// Hintergrund: Briefings/Digests/Tageslog werden auf Vercel erzeugt, Obsidian läuft
// aber lokal (localhost) → Vercel kann den Vault nie erreichen. Dieser LOKALE Agent
// schließt die Lücke: er liest Supabase und schreibt direkt in den Vault.
//
// Schreibt:
//   Logbuch/JJJJ/MM/JJJJ-MM-TT.md   ← Tagesdatei: Briefing (morgens) + Garmin + Notizen + Dokumente
//   Logbuch/Wochen/<woche>-training.md / -digest.md
//
// Das Morgen-Briefing wird OBEN in die Tagesdatei eingebettet (keine eigene Datei mehr).
// Der Tages-Digest bleibt ein reiner Telegram-Push (keine Vault-Datei).
//
// Tagesdateien werden NUR angelegt, wenn sie fehlen (Lücken füllen). Mit --force werden
// sie aus Supabase neu gebaut (überschreibt manuelle Bearbeitungen!).
// Briefings/Digests/Wochen sind generierte Artefakte → werden immer geschrieben.
//
// Aufruf:
//   node scripts/logbuch-sync.mjs
//   node scripts/logbuch-sync.mjs --days 60
//   node scripts/logbuch-sync.mjs --dry-run
//   node scripts/logbuch-sync.mjs --force      (Tagesdateien neu bauen)

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

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const hasFlag = (n) => process.argv.includes(`--${n}`)

const VAULT = arg('vault', 'D:\\Obsidian Vault')
const DAYS = Math.max(1, parseInt(arg('days', '30'), 10))
const DRY = hasFlag('dry-run')
const FORCE = hasFlag('force')

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const TZ = 'Europe/Berlin'
const GERMAN_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const berlinDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d))
const berlinTime = (d) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d))
function germanDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${String(d).padStart(2, '0')}. ${GERMAN_MONTHS[(m ?? 1) - 1]} ${y}`
}
function activityEmoji(type, name) {
  const t = `${type ?? ''} ${name ?? ''}`.toLowerCase()
  if (t.includes('swim') || t.includes('schwimm')) return '🏊'
  if (t.includes('cycl') || t.includes('bike') || t.includes('ride') || t.includes('rad')) return '🚴'
  if (t.includes('run') || t.includes('lauf')) return '🏃'
  if (t.includes('strength') || t.includes('kraft')) return '💪'
  return '🏋'
}
function fmtSleepDuration(min) {
  if (min == null) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}
const slug40 = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'plan'

let written = 0
let skipped = 0

function writeFileSafe(vaultRelPath, content, { overwrite }) {
  const abs = path.join(VAULT, ...vaultRelPath.split('/'))
  const exists = fs.existsSync(abs)
  if (exists && !overwrite) {
    skipped++
    return
  }
  if (DRY) {
    console.log(`  [dry] ${exists ? 'überschreiben' : 'schreiben'}: ${vaultRelPath}`)
    written++
    return
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf8')
  console.log(`  ${exists ? '↻' : '+'} ${vaultRelPath}`)
  written++
}

// ── Daten laden ────────────────────────────────────────────────────────────────
const cutoff = new Date(Date.now() - DAYS * 86400000)
const cutoffKey = berlinDate(cutoff)
const cutoffIso = cutoff.toISOString()

console.log(`\n=== Logbuch-Sync ${DRY ? '(DRY-RUN)' : ''} ===`)
console.log(`Vault: ${VAULT}`)
console.log(`Zeitraum: ab ${cutoffKey} (${DAYS} Tage)  ${FORCE ? '· Tagesdateien: FORCE-Rebuild' : '· Tagesdateien: nur fehlende'}\n`)

// Nur diese Quellen sind für die Tages-Timeline relevant (NICHT pdf-pipeline/Bücher,
// die sonst das PostgREST-1000er-Limit sprengen und neue Einträge verdrängen würden).
const TIMELINE_SOURCES = ['telegram_note', 'eingang', 'telegram_verwaltung', 'telegram_gesundheit', 'telegram']

const [acts, sleeps, notes, briefings, weeklyTrain, weeklyDig] = await Promise.all([
  sb.from('garmin_activities').select('date, type, name, duration_min, distance_km, avg_hr').gte('date', cutoffKey).order('date'),
  sb.from('garmin_sleep').select('date, sleep_score, hrv_nightly, hrv_status, total_sleep_min').gte('date', cutoffKey),
  sb.from('knowledge_entries').select('created_at, category, summary, raw_text, source, tags').in('source', TIMELINE_SOURCES).gte('created_at', cutoffIso).order('created_at'),
  sb.from('knowledge_entries').select('raw_text, tags').eq('source', 'morning_briefing').gte('created_at', cutoffIso),
  sb.from('knowledge_entries').select('raw_text, tags').eq('source', 'weekly_training').gte('created_at', cutoffIso),
  sb.from('knowledge_entries').select('raw_text, tags').eq('source', 'weekly_digest').gte('created_at', cutoffIso),
])

for (const r of [acts, sleeps, notes, briefings, weeklyTrain, weeklyDig]) {
  if (r.error) { console.error('DB-Fehler:', r.error.message); process.exit(1) }
}

const sleepByDate = new Map((sleeps.data ?? []).map((s) => [s.date, s]))
const actsByDate = new Map()
for (const a of acts.data ?? []) {
  if (!actsByDate.has(a.date)) actsByDate.set(a.date, [])
  actsByDate.get(a.date).push(a)
}

const NOTE_SOURCES = new Set(['telegram_note'])
const DOC_SOURCES = new Set(['eingang', 'telegram_verwaltung', 'telegram_gesundheit', 'telegram'])
const notesByDate = new Map()
const docsByDate = new Map()
const plansList = []
for (const n of notes.data ?? []) {
  const key = berlinDate(n.created_at)
  if ((n.tags ?? []).includes('plan')) { plansList.push(n); continue } // → eigene Plan-Dateien
  if (NOTE_SOURCES.has(n.source)) {
    if (!notesByDate.has(key)) notesByDate.set(key, [])
    notesByDate.get(key).push(n)
  } else if (DOC_SOURCES.has(n.source)) {
    if (!docsByDate.has(key)) docsByDate.set(key, [])
    docsByDate.get(key).push(n)
  }
}

const tagDate = (tags) => (tags ?? []).find((t) => /^\d{4}-\d{2}-\d{2}$/.test(t))
const tagWeek = (tags) => (tags ?? []).find((t) => /^\d{4}-W\d{2}$/.test(t))

// Morgen-Briefing je Tag → wird oben in die Tagesdatei eingebettet (keine eigene Datei).
const briefingByDate = new Map()
for (const b of briefings.data ?? []) {
  const d = tagDate(b.tags)
  if (d) briefingByDate.set(d, b.raw_text)
}

// ── Tages-Timeline bauen ────────────────────────────────────────────────────────
const allDays = new Set([...actsByDate.keys(), ...notesByDate.keys(), ...docsByDate.keys(), ...sleepByDate.keys(), ...briefingByDate.keys()])
console.log(`Tagesdateien (${allDays.size} Tage mit Daten):`)
for (const dateKey of [...allDays].sort()) {
  const sections = []

  // Briefing (morgens) — oberste Sektion, aus dem morning_briefing-Eintrag eingebettet.
  const briefingRaw = briefingByDate.get(dateKey)
  if (briefingRaw) {
    const blines = briefingRaw
      .replace(/^#\s+Briefing[^\n]*\n?/, '')      // eigene H1 entfernen
      .split('\n')
      .map((l) => l.replace(/^##\s+/, '### '))    // Unter-Überschriften eine Ebene tiefer
    while (blines.length && blines[0].trim() === '') blines.shift()
    while (blines.length && blines[blines.length - 1].trim() === '') blines.pop()
    if (blines.length) sections.push(['## ☀️ Briefing (morgens)', blines])
  }

  // Training (Garmin)
  const dayActs = actsByDate.get(dateKey) ?? []
  const sleep = sleepByDate.get(dateKey)
  const trainLines = []
  for (const a of dayActs) {
    const parts = []
    if (a.duration_min != null) parts.push(`${a.duration_min} min`)
    if (a.distance_km != null && a.distance_km > 0) parts.push(`${a.distance_km} km`)
    if (a.avg_hr != null) parts.push(`Ø${a.avg_hr} bpm`)
    trainLines.push(`- ${activityEmoji(a.type, a.name)} ${a.name || a.type || 'Aktivität'}${parts.length ? ' · ' + parts.join(' · ') : ''}`)
  }
  if (sleep?.sleep_score != null) {
    const dur = fmtSleepDuration(sleep.total_sleep_min)
    const bits = [dur ? `Schlaf ${dur}` : 'Schlaf', `Score ${sleep.sleep_score}`]
    if (sleep.hrv_nightly != null) bits.push(`HRV ${sleep.hrv_nightly}${sleep.hrv_status ? ` (${sleep.hrv_status.toLowerCase()})` : ''}`)
    trainLines.push(`- ${bits.join(' · ')}`)
  }
  if (trainLines.length) sections.push(['## 🏃 Training (Garmin)', trainLines])

  // Notizen
  const dayNotes = notesByDate.get(dateKey) ?? []
  const noteLines = dayNotes.map((n) => {
    const txt = (n.summary || n.raw_text || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    const cat = n.category ? `${n.category}: ` : ''
    return `- ${berlinTime(n.created_at)} ${cat}${txt}`
  })
  if (noteLines.length) sections.push(['## 📝 Notizen', noteLines])

  // Dokumente
  const dayDocs = docsByDate.get(dateKey) ?? []
  const docLines = dayDocs.map((d) => {
    const txt = (d.summary || d.raw_text || 'Dokument').replace(/\s+/g, ' ').trim().slice(0, 100)
    return `- ${berlinTime(d.created_at)} ${txt}${d.category ? ` → ${d.category}` : ''}`
  })
  if (docLines.length) sections.push(['## 📄 Dokumente', docLines])

  if (sections.length === 0) continue

  const body = [`# ${germanDate(dateKey)}`, '', ...sections.flatMap(([h, ls]) => [h, ...ls, ''])].join('\n').trimEnd() + '\n'
  const [y, m] = dateKey.split('-')
  writeFileSafe(`Logbuch/${y}/${m}/${dateKey}.md`, body, { overwrite: FORCE })
}

// ── Wochen-Zusammenfassungen (generierte Artefakte → immer schreiben) ────────────
// Briefing steckt jetzt in der Tagesdatei; der Tages-Digest bleibt Telegram-only.
console.log(`Wochen:`)
for (const wt of weeklyTrain.data ?? []) {
  const w = tagWeek(wt.tags); if (!w) continue
  writeFileSafe(`Logbuch/Wochen/${w}-training.md`, `---\nweek: ${w}\ntype: weekly_training\n---\n\n${wt.raw_text}`, { overwrite: true })
}
for (const wd of weeklyDig.data ?? []) {
  const w = tagWeek(wd.tags); if (!w) continue
  writeFileSafe(`Logbuch/Wochen/${w}-digest.md`, `---\nweek: ${w}\ntype: weekly_digest\n---\n\n# Wochen-Digest ${w}\n\n${wd.raw_text}`, { overwrite: true })
}

// ── Pläne: Reise-Pläne → Reisen/Pläne, Projekt-Pläne → Logbuch/Pläne und Ideen/Projekte ──
console.log(`Pläne:`)
for (const p of plansList) {
  const d = berlinDate(p.created_at)
  const summary = (p.summary || p.raw_text || 'Plan').replace(/\s+/g, ' ').trim()
  const isReise = (p.tags ?? []).includes('reisen')
  const folder = isReise ? 'Reisen/Pläne' : 'Logbuch/Pläne und Ideen/Projekte'
  const label = isReise ? 'Reisen' : 'Projekte'
  const content = `---\ndate: ${d}\ncategory: Projekte\nsubfolder: ${label}\nsource: telegram\n---\n\n# ${summary}\n\n${p.raw_text ?? ''}`
  writeFileSafe(`${folder}/${d}-${slug40(summary)}.md`, content, { overwrite: true })
}

console.log(`\n=== Fertig ${DRY ? '(DRY-RUN — nichts geschrieben)' : ''} ===`)
console.log(`Geschrieben: ${written}   Übersprungen (existiert, kein --force): ${skipped}`)

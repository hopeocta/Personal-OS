// Spiegelt Garmin-Tagesdaten aus Supabase als Markdown in den Obsidian-Vault.
// Läuft LOKAL auf dem PC (Obsidian-API = localhost, aus der Cloud nicht erreichbar).
// Eine kombinierte Datei pro Tag: Gesundheit/Training/JJJJ/MM/JJJJ-MM-TT.md
// (Abschnitte: Aktivitäten, Schlaf, HRV/Erholung, Training Load).
//
// Idempotent: PUT überschreibt die Datei mit dem aktuellen DB-Stand.
// Kein Embedding für Garmin (Zahlen-Fragen laufen über query_metrics/SQL).
//
// Voraussetzung: .env.local mit SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL,
//                OBSIDIAN_API_URL, OBSIDIAN_API_KEY. Obsidian (Local REST API) muss laufen.
//
// Aufruf:
//   node scripts/garmin-obsidian-sync.mjs            (letzte 30 Tage)
//   node scripts/garmin-obsidian-sync.mjs --days 7
//   node scripts/garmin-obsidian-sync.mjs --all      (gesamte Historie)
//   node scripts/garmin-obsidian-sync.mjs --dry-run  (nur anzeigen, nichts schreiben)
//
// Optionen:
//   --days N    Tage rückwärts ab heute (Standard 30)
//   --all       gesamte Historie (überschreibt --days)
//   --dry-run   baut die Dateien, schreibt aber nicht nach Obsidian
//   --delay     ms Pause zwischen Schreibvorgängen (Standard 50)

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OBSIDIAN_API_URL = process.env.OBSIDIAN_API_URL?.replace(/\/$/, '')
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Fehlende Env Vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const hasFlag = (name) => process.argv.includes(`--${name}`)

const ALL = hasFlag('all')
const DAYS = Math.max(1, parseInt(arg('days', '30'), 10))
const DRY_RUN = hasFlag('dry-run')
const DELAY_MS = Math.max(0, parseInt(arg('delay', '50'), 10))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Datums-Helfer ─────────────────────────────────────────────────────────────
function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}
function shiftKey(key, deltaDays) {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}
function titleDate(key) {
  const d = new Date(`${key}T12:00:00Z`)
  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'UTC' }).format(d)
  const [y, m, day] = key.split('-')
  return `${weekday}, ${day}.${m}.${y}`
}

// ── Formatierung ──────────────────────────────────────────────────────────────
function fmtDuration(min) {
  if (min == null) return null
  if (min >= 60) return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
  return `${min} min`
}
function num(v) {
  return v == null ? null : String(v)
}
const ACTIVITY_LABELS = {
  running: 'Laufen',
  cycling: 'Radfahren',
  road_biking: 'Radfahren',
  indoor_cycling: 'Radfahren (Indoor)',
  lap_swimming: 'Schwimmen',
  open_water_swimming: 'Freiwasserschwimmen',
  swimming: 'Schwimmen',
  strength_training: 'Krafttraining',
  cardio: 'Cardio',
  walking: 'Gehen',
  hiking: 'Wandern',
  yoga: 'Yoga',
  treadmill_running: 'Laufband',
}
function activityLabel(type) {
  if (!type) return 'Aktivität'
  return ACTIVITY_LABELS[type] ?? type.replace(/_/g, ' ')
}

// ── MD-Bau ────────────────────────────────────────────────────────────────────
function buildMarkdown(key, { activities, sleep: s, bb, training: t }) {
  const lines = []
  lines.push('---')
  lines.push(`date: ${key}`)
  lines.push('source: garmin')
  lines.push('---')
  lines.push(`# Garmin · ${titleDate(key)}`)
  lines.push('')

  // Aktivitäten
  lines.push('## 🏃 Aktivitäten')
  if (activities.length === 0) {
    lines.push('_Keine Aktivitäten_')
  } else {
    for (const a of activities) {
      const parts = [`**${activityLabel(a.type)}**`]
      if (a.distance_km != null) parts.push(`${a.distance_km} km`)
      const dur = fmtDuration(a.duration_min)
      if (dur) parts.push(dur)
      if (a.avg_hr != null) parts.push(`Ø${a.avg_hr} bpm${a.max_hr != null ? ` (max ${a.max_hr})` : ''}`)
      if (a.avg_pace) parts.push(a.avg_pace)
      if (a.avg_power != null) parts.push(`Ø${a.avg_power} W${a.norm_power != null ? ` (NP ${a.norm_power})` : ''}`)
      if (a.calories != null) parts.push(`${a.calories} kcal`)
      if (a.elevation_m != null) parts.push(`${a.elevation_m} m HM`)
      let line = `- ${parts.join(' · ')}`
      if (a.name) line += `\n  _${a.name}_`
      lines.push(line)
    }
  }
  lines.push('')

  // Schlaf
  lines.push('## 😴 Schlaf')
  if (s) {
    const total = fmtDuration(s.total_sleep_min)
    const head = [s.sleep_score != null ? `Score **${s.sleep_score}**` : null, total ? `${total} gesamt` : null].filter(Boolean)
    if (head.length) lines.push(`- ${head.join(' · ')}`)
    const phases = [
      s.deep_sleep_min != null ? `Tief ${fmtDuration(s.deep_sleep_min)}` : null,
      s.rem_sleep_min != null ? `REM ${fmtDuration(s.rem_sleep_min)}` : null,
      s.light_sleep_min != null ? `Leicht ${fmtDuration(s.light_sleep_min)}` : null,
      s.awake_min != null ? `Wach ${fmtDuration(s.awake_min)}` : null,
    ].filter(Boolean)
    if (phases.length) lines.push(`- ${phases.join(' · ')}`)
    const vitals = [
      s.resting_hr != null ? `Ruhepuls ${s.resting_hr}` : null,
      s.hrv_nightly != null ? `HRV nächtlich ${s.hrv_nightly}` : null,
    ].filter(Boolean)
    if (vitals.length) lines.push(`- ${vitals.join(' · ')}`)
  } else {
    lines.push('_Keine Schlafdaten_')
  }
  lines.push('')

  // HRV & Erholung (Schlaf-Zusatz + Body Battery)
  const recovery = []
  if (s && (s.hrv_status || s.hrv_baseline_low != null || s.hrv_weekly_avg != null)) {
    const base =
      s.hrv_baseline_low != null && s.hrv_baseline_high != null
        ? ` (Baseline ${s.hrv_baseline_low}–${s.hrv_baseline_high}${s.hrv_weekly_avg != null ? `, 7-Tage-Ø ${s.hrv_weekly_avg}` : ''})`
        : s.hrv_weekly_avg != null
          ? ` (7-Tage-Ø ${s.hrv_weekly_avg})`
          : ''
    recovery.push(`- HRV-Status: ${s.hrv_status ?? 'unbekannt'}${base}`)
  }
  if (bb && (bb.morning_score != null || bb.evening_score != null)) {
    recovery.push(`- Body Battery: morgens ${num(bb.morning_score) ?? '–'} / abends ${num(bb.evening_score) ?? '–'}`)
  }
  if (bb) {
    const stress = [
      bb.stress_avg != null ? `Stress Ø ${bb.stress_avg}` : null,
      bb.stress_min_low != null || bb.stress_min_med != null || bb.stress_min_high != null
        ? `Stressminuten: niedrig ${bb.stress_min_low ?? 0}, mittel ${bb.stress_min_med ?? 0}, hoch ${bb.stress_min_high ?? 0}`
        : null,
      bb.rest_min != null ? `Erholung ${bb.rest_min} min` : null,
    ].filter(Boolean)
    if (stress.length) recovery.push(`- ${stress.join(' · ')}`)
  }
  if (s && s.rhr_7day_avg != null) recovery.push(`- 7-Tage-Ruhepuls Ø ${s.rhr_7day_avg}`)
  if (recovery.length) {
    lines.push('## ❤️ HRV & Erholung')
    lines.push(...recovery)
    lines.push('')
  }

  // Training Load
  if (t && (t.vo2max != null || t.atl != null || t.ctl != null || t.acwr != null || t.training_status)) {
    lines.push('## 📈 Training Load')
    if (t.vo2max != null) lines.push(`- VO2max **${t.vo2max}**`)
    const load = [
      t.atl != null ? `ATL ${t.atl}` : null,
      t.ctl != null ? `CTL ${t.ctl}` : null,
      t.acwr != null ? `ACWR ${t.acwr}${t.acwr_status ? ` (${t.acwr_status})` : ''}` : null,
    ].filter(Boolean)
    if (load.length) lines.push(`- ${load.join(' · ')}`)
    // training_status ist teils ein numerischer Garmin-Code → lieber die lesbare Phrase zeigen.
    const statusLabel = t.status_phrase
      ? t.status_phrase.replace(/_/g, ' ')
      : t.training_status != null && !/^\d+$/.test(String(t.training_status))
        ? String(t.training_status)
        : null
    if (statusLabel) lines.push(`- Status: ${statusLabel}`)
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}

// ── Obsidian-Write ────────────────────────────────────────────────────────────
async function writeToObsidian(key, content) {
  const [y, m] = key.split('-')
  const filepath = `Gesundheit/Training/${y}/${m}/${key}.md`
  const encoded = filepath.split('/').map(encodeURIComponent).join('/')
  const res = await fetch(`${OBSIDIAN_API_URL}/vault/${encoded}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${OBSIDIAN_API_KEY}`, 'Content-Type': 'text/markdown' },
    body: content,
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`)
  return filepath
}

// ── Hauptlauf ─────────────────────────────────────────────────────────────────
const toKey = todayKey()
const fromKey = ALL ? '2000-01-01' : shiftKey(toKey, -(DAYS - 1))

console.log(`\n=== Garmin → Obsidian Sync ===`)
console.log(`Bereich: ${ALL ? 'gesamte Historie' : `${fromKey} … ${toKey} (${DAYS} Tage)`}`)
console.log(`Ziel:    Gesundheit/Training/JJJJ/MM/  ${DRY_RUN ? '(DRY-RUN, kein Schreiben)' : `→ ${OBSIDIAN_API_URL}`}\n`)

if (!DRY_RUN && (!OBSIDIAN_API_URL || !OBSIDIAN_API_KEY)) {
  console.error('Fehlende Env Vars: OBSIDIAN_API_URL, OBSIDIAN_API_KEY (oder --dry-run nutzen)')
  process.exit(1)
}

// Alle vier Tabellen für den Bereich laden.
async function loadAll(table) {
  let q = sb.from(table).select('*').lte('date', toKey).order('date')
  if (!ALL) q = q.gte('date', fromKey)
  const { data, error } = await q
  if (error) {
    console.error(`Fehler beim Laden von ${table}:`, error.message)
    process.exit(1)
  }
  return data ?? []
}

const [actRows, sleepRows, bbRows, trainRows] = await Promise.all([
  loadAll('garmin_activities'),
  loadAll('garmin_sleep'),
  loadAll('garmin_body_battery'),
  loadAll('garmin_training'),
])

// Nach Datum gruppieren.
const byDate = new Map()
const ensure = (key) => {
  if (!byDate.has(key)) byDate.set(key, { activities: [], sleep: null, bb: null, training: null })
  return byDate.get(key)
}
for (const r of actRows) ensure(r.date).activities.push(r)
for (const r of sleepRows) ensure(r.date).sleep = r
for (const r of bbRows) ensure(r.date).bb = r
for (const r of trainRows) ensure(r.date).training = r

const dates = [...byDate.keys()].sort()
console.log(`Tage mit Daten: ${dates.length}\n`)

let written = 0
const errors = []
for (const key of dates) {
  const content = buildMarkdown(key, byDate.get(key))
  if (DRY_RUN) {
    const day = byDate.get(key)
    console.log(`• ${key}  (Akt ${day.activities.length}, Schlaf ${day.sleep ? '✓' : '–'}, BB ${day.bb ? '✓' : '–'}, Load ${day.training ? '✓' : '–'})`)
    continue
  }
  try {
    const path = await writeToObsidian(key, content)
    written++
    if (written <= 5 || written % 25 === 0) console.log(`✓ ${path}`)
  } catch (e) {
    errors.push(`${key}: ${e.message}`)
    console.warn(`⚠ ${key}: ${e.message}`)
  }
  if (DELAY_MS) await sleep(DELAY_MS)
}

console.log(`\n=== Fertig ===`)
if (DRY_RUN) {
  console.log(`${dates.length} Tagesdateien würden geschrieben (DRY-RUN).`)
} else {
  console.log(`Geschrieben: ${written}/${dates.length}   Fehler: ${errors.length}`)
  if (errors.length) {
    console.log('\nErste Fehler:')
    for (const e of errors.slice(0, 10)) console.log(`  - ${e}`)
  }
}

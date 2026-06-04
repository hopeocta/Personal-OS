// Normalisiert bestehende health_labs-Zeilen auf kanonische test_name-Werte.
// Einmaliger Aufruf reicht; Script ist idempotent (überschreibt bereits korrekte Werte nicht).
//
// WICHTIG: Alias-Tabelle SYNCHRON mit lib/metricDefs.ts halten.
//
// Aufruf:
//   node scripts/normalize-health-labs.mjs           (scharf)
//   node scripts/normalize-health-labs.mjs --dry-run (nur zeigen, nichts schreiben)

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true, quiet: true })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Fehlende Env Vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')

// ── Alias-Tabelle (synchron mit lib/metricDefs.ts halten) ────────────────────
const METRIC_DEFS = [
  { canonical: 'Hämoglobin',        aliases: ['HGB', 'Hb', 'Hemoglobin', 'Hemoglobina'] },
  { canonical: 'Leukozyten',        aliases: ['WBC'] },
  { canonical: 'Erythrozyten',      aliases: ['RBC'] },
  { canonical: 'Thrombozyten',      aliases: ['PLT'] },
  { canonical: 'Hämatokrit',        aliases: ['Ematocrito', 'HKT', 'Hct'] },
  { canonical: 'MCH',               aliases: ['HbE (MCH)', 'HbE'] },
  { canonical: 'Glukose',           aliases: ['Blutzucker (NaF)', 'Glicemia', 'Blutzucker', 'Glucose'] },
  { canonical: 'Kreatinin',         aliases: ['Creatininemia', 'Creatinin', 'Creatinine'] },
  { canonical: 'ALT',               aliases: ['GPT', 'Alanin-Aminotransferase', 'ALAT'] },
  { canonical: 'AST',               aliases: ['GOT', 'Aspartat-Aminotransferase', 'ASAT'] },
  { canonical: 'Lymphozyten',       aliases: ['Linfociti'] },
  { canonical: 'Eosinophile',       aliases: ['Eosinofili'] },
  { canonical: 'Basophile',         aliases: ['Basofili'] },
  { canonical: 'Monozyten',         aliases: ['Monociti'] },
  { canonical: 'Neutrophile',       aliases: ['Neutrophile Granulozyten', 'Neutrofili'] },
  { canonical: 'Gesamtcholesterin', aliases: ['Ges.-Cholesterin', 'Cholesterol totale', 'Cholesterol', 'Gesamt-Cholesterin'] },
  { canonical: 'Bilirubin',         aliases: ['Bilirubin totale', 'Gesamtbilirubin'] },
  { canonical: 'BMI',               aliases: ['Body-Mass-Index (BMI)', 'Body Mass Index'] },
  { canonical: 'Körpergröße',       aliases: ['Körpergroesse', 'Koerpergröße', 'Körperhöhe'] },
  { canonical: 'Körpergewicht',     aliases: ['Gewicht'] },
]

function resolveCanonical(raw) {
  const lower = raw.toLowerCase().trim()
  for (const def of METRIC_DEFS) {
    if (def.canonical.toLowerCase() === lower) return def.canonical
    if (def.aliases.some((a) => a.toLowerCase() === lower)) return def.canonical
  }
  return null // unbekannt → nicht anfassen
}

// ── Haupt-Logik ───────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '🔍 Dry-Run — nichts wird geschrieben.\n' : '✏️ Normalisierung startet.\n')

  // Alle health_labs-Zeilen laden (id + test_name reicht)
  const { data: rows, error } = await supabase
    .from('health_labs')
    .select('id, test_name')
    .order('test_name')

  if (error) {
    console.error('Fehler beim Laden:', error)
    process.exit(1)
  }

  console.log(`${rows.length} Zeilen geladen.`)

  const toUpdate = []
  const alreadyCanonical = []
  const unknown = new Set()

  for (const row of rows) {
    const canonical = resolveCanonical(row.test_name)
    if (canonical === null) {
      unknown.add(row.test_name)
    } else if (canonical !== row.test_name) {
      toUpdate.push({ id: row.id, old: row.test_name, new: canonical })
    } else {
      alreadyCanonical.push(row.test_name)
    }
  }

  console.log(`\n✅ Bereits kanonisch: ${alreadyCanonical.length} Zeilen`)
  console.log(`✏️ Umzubenennen:      ${toUpdate.length} Zeilen`)
  console.log(`❓ Unbekannt:         ${unknown.size} verschiedene Namen`)

  if (toUpdate.length > 0) {
    console.log('\n── Umbenennungen ──')
    for (const u of toUpdate) {
      console.log(`  "${u.old}" → "${u.new}"`)
    }
  }

  if (unknown.size > 0) {
    console.log('\n── Unbekannte (bleiben unverändert) ──')
    for (const name of [...unknown].sort()) {
      console.log(`  "${name}"`)
    }
  }

  if (DRY_RUN || toUpdate.length === 0) {
    console.log('\nFertig (Dry-Run oder nichts zu tun).')
    return
  }

  // Updates ausführen (einzeln, um Fehler zu isolieren)
  let ok = 0
  let fail = 0
  for (const u of toUpdate) {
    const { error: upErr } = await supabase
      .from('health_labs')
      .update({ test_name: u.new })
      .eq('id', u.id)
    if (upErr) {
      console.error(`  FEHLER bei ID ${u.id} ("${u.old}"): ${upErr.message}`)
      fail++
    } else {
      ok++
    }
  }

  console.log(`\n✅ ${ok} Zeilen normalisiert${fail > 0 ? `, ❌ ${fail} Fehler` : ''}.`)
}

run().catch((err) => {
  console.error('Unerwarteter Fehler:', err)
  process.exit(1)
})

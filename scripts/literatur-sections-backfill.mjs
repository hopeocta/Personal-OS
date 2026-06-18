// Literatur-Backfill: erzeugt die deutschen 4-Sektionen (sections_de) für bestehende
// literatur_entries, die noch keine haben (z.B. Artikel, die vor Migration 0015 entstanden
// oder als der Newsletter-Cron noch nicht in die — damals fehlende — Spalte schreiben konnte).
//
// Pro Artikel: ein Claude-Haiku-Call mit EXAKT demselben System-Prompt wie lib/newsletter.ts
// (generateSectionsDe) → JSON {hintergrund, methodik_ergebnisse, schlussfolgerung, fortschritt}
// → in literatur_entries.sections_de geschrieben. ~0,1 Cent pro Artikel.
//
// Voraussetzung: .env.local mit ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Aufruf:
//   node scripts/literatur-sections-backfill.mjs            (alle NULL-Einträge)
//   node scripts/literatur-sections-backfill.mjs --dry-run  (nur zeigen, nichts schreiben)
//   node scripts/literatur-sections-backfill.mjs --kw 25 --jahr 2026   (nur eine Woche)

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'

dotenv.config({ path: '.env.local', override: true, quiet: true })

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Fehlende Env Vars: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const DRY_RUN = process.argv.includes('--dry-run')
const KW = arg('kw', null)
const JAHR = arg('jahr', null)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// 1:1 aus lib/newsletter.ts generateSectionsDe()
async function generateSectionsDe(title, abstract) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Du bist medizinischer Wissenschaftsjournalist. Analysiere diesen PubMed-Artikel und antworte NUR mit validem JSON, ohne Markdown-Blöcke oder Erklärungen.

JSON-Format:
{
  "hintergrund": "Warum wurde diese Studie gemacht? Was war die Forschungsfrage? (2-3 Sätze)",
  "methodik_ergebnisse": "Wie wurde geforscht, wie viele Patienten/Probanden, was kam konkret raus? (3-4 Sätze)",
  "schlussfolgerung": "Was bedeutet das klinisch? Was sollte ein Arzt daraus mitnehmen? (2-3 Sätze)",
  "fortschritt": "Was ist das Neue an dieser Studie? Was ändert sich dadurch in der Medizin oder Praxis? (2-3 Sätze)"
}

Sprache: Deutsch. Fachlich korrekt aber verständlich.`,
      messages: [{
        role: 'user',
        content: `Titel: ${title}\n\nAbstract: ${abstract || 'Kein Abstract verfügbar.'}`,
      }],
    })
    let text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    // Haiku umschließt das JSON oft mit ```json ... ``` trotz Prompt → Fences strippen,
    // notfalls das erste {...}-Objekt aus dem Text herausschneiden.
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    if (!text.startsWith('{')) {
      const m = text.match(/\{[\s\S]*\}/)
      if (m) text = m[0]
    }
    return JSON.parse(text)
  } catch (err) {
    console.error(`  !! Fehler bei "${title.slice(0, 60)}":`, err.message)
    return null
  }
}

async function main() {
  let query = supabase
    .from('literatur_entries')
    .select('id, kw, jahr, title, summary')
    .is('sections_de', null)
    .order('jahr', { ascending: false })
    .order('kw', { ascending: false })
  if (KW) query = query.eq('kw', Number(KW))
  if (JAHR) query = query.eq('jahr', Number(JAHR))

  const { data: rows, error } = await query
  if (error) { console.error('Supabase-Fehler:', error.message); process.exit(1) }
  if (!rows?.length) { console.log('Nichts zu tun — alle Einträge haben bereits sections_de.'); return }

  console.log(`${rows.length} Artikel ohne sections_de gefunden${KW ? ` (KW ${KW}/${JAHR ?? '*'})` : ''}.${DRY_RUN ? ' [DRY-RUN]' : ''}\n`)

  let ok = 0, fail = 0
  for (const row of rows) {
    process.stdout.write(`• KW${row.kw}/${row.jahr} "${row.title.slice(0, 55)}..." `)
    if (DRY_RUN) { console.log('(dry-run)'); continue }

    const sections = await generateSectionsDe(row.title, row.summary)
    if (!sections) { fail++; continue }

    const { error: updErr } = await supabase
      .from('literatur_entries')
      .update({ sections_de: sections })
      .eq('id', row.id)
    if (updErr) { console.log(`✗ ${updErr.message}`); fail++; continue }
    console.log('✓')
    ok++
  }

  console.log(`\nFertig — ${ok} aufbereitet, ${fail} fehlgeschlagen, ${rows.length} gesamt.`)
}

main()

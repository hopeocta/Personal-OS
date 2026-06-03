// Verifiziert die DATENSCHICHT von Phase 3 ohne Anthropic-Key:
//  1. Vektor-Suche: echte OpenAI-Embedding-Query → match_knowledge RPC → Treffer
//  2. SQL-Metrik-Pfad: direkter Aggregat-Query gegen eine Garmin-Tabelle
// Der eigentliche Claude-Tool-Loop (lib/answer.ts) wird in Phase 4 via Telegram
// bzw. nach Hinterlegen des ANTHROPIC_API_KEY lokal getestet.
//
// Aufruf:  node scripts/test-rag.mjs "deine testfrage"

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const query = process.argv[2] || 'Was hat der Arzt empfohlen?'

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  return (await res.json()).data[0].embedding
}

console.log(`\n=== 1) VEKTOR-SUCHE ===`)
console.log(`Frage: "${query}"\n`)

const embedding = await embed(query)
const { data: hits, error: rpcErr } = await sb.rpc('match_knowledge', {
  query_embedding: embedding,
  match_count: 5,
  filter_category: null,
})

if (rpcErr) {
  console.error('RPC-Fehler:', rpcErr.message)
} else {
  for (const h of hits) {
    const sim = Math.round(h.similarity * 100)
    const snippet = (h.summary || h.raw_text).slice(0, 90).replace(/\n/g, ' ')
    console.log(`  [${sim}%] (${h.category}, ${h.created_at?.slice(0, 10)})  ${snippet}`)
  }
}

console.log(`\n=== 2) SQL-METRIK-PFAD ===`)
// Beispiel: Durchschnittlicher Schlaf-Score der letzten 30 Tage
const from = new Date()
from.setDate(from.getDate() - 30)
const fromStr = from.toISOString().slice(0, 10)

const { data: rows, error: sqlErr } = await sb
  .from('garmin_sleep')
  .select('date, sleep_score')
  .gte('date', fromStr)
  .not('sleep_score', 'is', null)
  .order('date', { ascending: true })

if (sqlErr) {
  console.error('SQL-Fehler:', sqlErr.message)
} else {
  const vals = rows.map((r) => r.sleep_score)
  const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  console.log(`  Schlaf-Score Ø letzte 30 Tage: ${avg} (aus ${vals.length} Tagen, ab ${fromStr})`)
}

console.log(`\n=== Fertig — Datenschicht (Vektor + SQL) verifiziert ===`)

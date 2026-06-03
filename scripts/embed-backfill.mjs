// Bettet alle knowledge_entries ohne Embedding ein (idempotent: WHERE embedding IS NULL).
// Nutzt OpenAI text-embedding-3-small (1536d). Kosten für 1105 Einträge: < 1 Cent.
//
// Voraussetzung: .env.local mit OPENAI_API_KEY + SUPABASE_SERVICE_ROLE_KEY
//
// Aufruf:
//   node scripts/embed-backfill.mjs
//   node scripts/embed-backfill.mjs --batch 50 --delay 300
//
// Optionen:
//   --batch   Einträge pro DB-Abfrage (Standard 100)
//   --delay   ms Pause zwischen Batches (Standard 250)

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMBED_MODEL = 'text-embedding-3-small'

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Fehlende Env Vars: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

// OpenAI-Limit: 8192 Tokens pro Input. Medizinischer PDF-Text kann token-dicht sein
// (~2 Zeichen/Token). 6000 Zeichen ≈ max 3000 Tokens — sicher unter dem Limit.
const BATCH_SIZE = Math.min(50, Math.max(1, parseInt(arg('batch', '20'), 10)))
const DELAY_MS = Math.max(0, parseInt(arg('delay', '250'), 10))
const MAX_CHARS_PER_INPUT = 6000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function embedBatch(inputs) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  })
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10)
    console.warn(`  ⚠ Rate limit — warte ${retryAfter}s`)
    await sleep(retryAfter * 1000)
    return embedBatch(inputs)
  }
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`OpenAI ${res.status}: ${msg}`)
  }
  const json = await res.json()
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

console.log(`\n=== Embedding Backfill (${EMBED_MODEL}) ===`)
console.log(`Batch: ${BATCH_SIZE}  |  Pause: ${DELAY_MS}ms\n`)

// Vorher: wie viele fehlen noch?
const { count: totalMissing } = await sb
  .from('knowledge_entries')
  .select('*', { count: 'exact', head: true })
  .is('embedding', null)
console.log(`Einträge ohne Embedding: ${totalMissing}\n`)

let totalDone = 0
let totalErrors = 0

while (true) {
  const { data: rows, error: fetchErr } = await sb
    .from('knowledge_entries')
    .select('id, summary, raw_text')
    .is('embedding', null)
    .limit(BATCH_SIZE)

  if (fetchErr) {
    console.error('DB-Fehler beim Lesen:', fetchErr.message)
    process.exit(1)
  }
  if (!rows || rows.length === 0) break

  const inputs = rows.map((r) =>
    `${r.summary ?? ''}\n\n${r.raw_text ?? ''}`.slice(0, MAX_CHARS_PER_INPUT)
  )

  let embeddings
  try {
    embeddings = await embedBatch(inputs)
  } catch (err) {
    console.error(`Embedding-Fehler für Batch: ${err.message}`)
    totalErrors += rows.length
    if (DELAY_MS) await sleep(DELAY_MS)
    continue
  }

  // Einzeln updaten (Supabase JS Client unterstützt kein Bulk-Update mit verschiedenen Werten)
  let batchOk = 0
  for (let i = 0; i < rows.length; i++) {
    const { error: updateErr } = await sb
      .from('knowledge_entries')
      .update({ embedding: embeddings[i] })
      .eq('id', rows[i].id)

    if (updateErr) {
      console.error(`  Update-Fehler ID ${rows[i].id}: ${updateErr.message}`)
      totalErrors++
    } else {
      batchOk++
    }
  }

  totalDone += batchOk
  console.log(`+${batchOk} embedded  |  gesamt: ${totalDone}  |  Fehler: ${totalErrors}`)

  if (DELAY_MS) await sleep(DELAY_MS)
}

// Abschlussprüfung
const { count: remaining } = await sb
  .from('knowledge_entries')
  .select('*', { count: 'exact', head: true })
  .is('embedding', null)

const { count: total } = await sb
  .from('knowledge_entries')
  .select('*', { count: 'exact', head: true })

console.log(`\n=== Fertig ===`)
console.log(`Embedded:  ${totalDone}`)
console.log(`Fehler:    ${totalErrors}`)
console.log(`Verbleibend ohne Embedding: ${remaining} von ${total}`)

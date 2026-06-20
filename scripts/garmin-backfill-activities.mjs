// Aktivitäten-Backfill für beliebige Personen.
// Ruft /api/garmin/backfill in Batches auf und folgt next_start bis done=true.
// Dev-Server muss laufen: npm run dev
//
// Aufruf:
//   node scripts/garmin-backfill-activities.mjs --person p1
//   node scripts/garmin-backfill-activities.mjs --person p1 --months 60 --delay 500
//
// Optionen:
//   --person   user_id (Standard 'me')
//   --months   Wie weit zurück in Monaten (Standard 60 = 5 Jahre)
//   --url      Basis-URL (Standard http://localhost:3000)
//   --delay    ms Pause zwischen Batches (Standard 400)
//   --retries  Versuche pro Batch bei Fehler (Standard 3)

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const BASE    = arg('url', 'http://localhost:3000').replace(/\/$/, '')
const PERSON  = arg('person', 'me')
const MONTHS  = parseInt(arg('months', '60'), 10)
const DELAY   = Math.max(0, parseInt(arg('delay', '400'), 10))
const RETRIES = Math.max(1, parseInt(arg('retries', '3'), 10))

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchBatch(start, attempt = 1) {
  const url = `${BASE}/api/garmin/backfill?start=${start}&months=${MONTHS}&person=${PERSON}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    return await res.json()
  } catch (e) {
    if (attempt < RETRIES) {
      console.warn(`  Fehler (Versuch ${attempt}/${RETRIES}): ${e.message} — Retry in 2s...`)
      await sleep(2000)
      return fetchBatch(start, attempt + 1)
    }
    throw e
  }
}

console.log(`\n=== Aktivitäten-Backfill: ${PERSON} (letzte ${MONTHS} Monate) ===\n`)

let start = 0
let totalSynced = 0
let batchNr = 0

while (true) {
  batchNr++
  process.stdout.write(`Batch ${batchNr} (start=${start})... `)

  let data
  try {
    data = await fetchBatch(start)
  } catch (e) {
    console.error(`\nFehler nach ${RETRIES} Versuchen:`, e.message)
    process.exit(1)
  }

  totalSynced += data.synced ?? 0
  const skipped = data.skipped_old ?? 0
  const errors = data.errors ?? []

  console.log(`${data.synced} gespeichert, ${skipped} übersprungen (zu alt)${errors.length ? `, ${errors.length} Fehler` : ''}`)
  if (errors.length) {
    errors.slice(0, 3).forEach(e => console.warn('  ⚠', e))
  }

  if (data.done) break

  start = data.next_start
  await sleep(DELAY)
}

console.log(`\n=== Fertig: ${totalSynced} Aktivitäten gespeichert (${PERSON}) ===\n`)
console.log('Nächster Schritt: Schlaf-Backfill laufen lassen:')
console.log(`  node scripts/garmin-backfill-sleep.mjs --person ${PERSON}`)
console.log()

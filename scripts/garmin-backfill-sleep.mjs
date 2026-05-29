// Treiber für den Schlaf/Stress/Body-Battery-Backfill.
//
// Die Route /api/garmin/backfill-sleep arbeitet Tag-für-Tag (2 Garmin-Requests
// pro Tag) und kapselt die Garmin-Logik. Auf Vercel reißt ein großer Batch das
// 300s-Limit — daher paginieren wir hier in moderaten Chunks gegen den lokalen
// Dev-Server (kein Timeout) und folgen dem von der Route gelieferten next_offset
// bis done=true. Bei Fehlern wird der gleiche Offset mehrfach versucht.
//
// Aufruf (Dev-Server muss laufen: npm run dev):
//   node scripts/garmin-backfill-sleep.mjs
//   node scripts/garmin-backfill-sleep.mjs --url http://localhost:3000 --days 30 --delay 500
//
// Optionen:
//   --url    Basis-URL (Standard http://localhost:3000)
//   --days   Tage pro Batch (Standard 30, max 60 laut Route)
//   --offset Start-Offset in Tagen zurück (Standard 0 = heute)
//   --delay  ms Pause zwischen Batches (Standard 300)
//   --retries Versuche pro Batch bei Fehler (Standard 3)

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg("url", "http://localhost:3000").replace(/\/$/, "");
const DAYS = Math.min(60, Math.max(1, parseInt(arg("days", "30"), 10)));
const DELAY = Math.max(0, parseInt(arg("delay", "300"), 10));
const RETRIES = Math.max(1, parseInt(arg("retries", "3"), 10));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callBatch(offset) {
  const url = `${BASE}/api/garmin/backfill-sleep?offset=${offset}&days=${DAYS}`;
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      return body;
    } catch (e) {
      lastErr = e;
      console.warn(`  ⚠ Versuch ${attempt}/${RETRIES} fehlgeschlagen: ${e.message}`);
      if (attempt < RETRIES) await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

console.log(`\n=== Garmin Schlaf/Stress Backfill ===`);
console.log(`Ziel: ${BASE}  |  Batch: ${DAYS} Tage  |  Pause: ${DELAY}ms\n`);

let offset = Math.max(0, parseInt(arg("offset", "0"), 10));
let totalSleep = 0;
let totalBB = 0;
let totalTraining = 0;
const allErrors = [];

while (offset != null) {
  const t0 = Date.now();
  const r = await callBatch(offset);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  totalSleep += r.synced_sleep ?? 0;
  totalBB += r.synced_body_battery ?? 0;
  totalTraining += r.synced_training ?? 0;
  if (Array.isArray(r.errors)) allErrors.push(...r.errors);

  console.log(
    `Tage ${String(r.range?.from).padStart(3)}–${String(r.range?.to).padEnd(3)} zurück  ` +
      `| Schlaf +${r.synced_sleep}  BB +${r.synced_body_battery}  Training +${r.synced_training ?? 0}  ` +
      `| ${r.errors?.length ?? 0} Fehler  | ${secs}s`
  );

  if (r.done) break;
  offset = r.next_offset;
  if (DELAY) await sleep(DELAY);
}

console.log(`\n=== Fertig ===`);
console.log(`Schlaf-Tage gesamt:        ${totalSleep}`);
console.log(`Body-Battery-Tage gesamt:  ${totalBB}`);
console.log(`Training-Tage gesamt:      ${totalTraining}`);
console.log(`Fehler gesamt:             ${allErrors.length}`);
if (allErrors.length) {
  console.log(`\nErste 20 Fehler:`);
  for (const e of allErrors.slice(0, 20)) console.log(`  - ${e}`);
}

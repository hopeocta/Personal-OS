// Holt Detail-Zeitreihen einzelner Aktivitäten direkt aus der Garmin Connect API:
// HF, Höhe, Distanz und Tempo pro Sample (inkl. Multisport-Child-Aktivitäten).
// Auth über die in Supabase (garmin_auth) gespeicherten OAuth-Tokens.
//
// Der normale Garmin-Sync (/api/garmin/sync) speichert nur Summenwerte je Aktivität.
// Für HF-/Höhen-/Tempo-Graphen INNERHALB einer Aktivität braucht es diese Zeitreihen.
//
// Aufruf: node scripts/garmin-activity-hr.mjs <activityId> [<activityId> ...]
// Ausgabe: JSON nach scripts/.garmin-hr-out.json
//
// Sample-Felder: t (Minuten), km (Distanz), hr (bpm), elev (Höhe m), speed (km/h)
// Pro Segment zusätzlich: elev_gain_m (kumulierte Höhenmeter)

import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync } from 'node:fs'
import { GarminConnect } from 'garmin-connect'
import { createClient } from '@supabase/supabase-js'

const personIdx = process.argv.indexOf('--person')
const PERSON = personIdx !== -1 && process.argv[personIdx + 1] ? process.argv[personIdx + 1] : 'me'
const ids = process.argv.slice(2).filter((a, i, arr) => a !== '--person' && arr[i - 1] !== '--person')
if (ids.length === 0) {
  console.error('Keine activityId angegeben')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getClient() {
  const { data } = await supabase
    .from('garmin_auth')
    .select('oauth1, oauth2')
    .eq('user_id', PERSON)
    .maybeSingle()
  const client = new GarminConnect({
    username: process.env.GARMIN_EMAIL ?? '',
    password: process.env.GARMIN_PASSWORD ?? '',
  })
  if (data?.oauth1 && data?.oauth2) {
    client.loadToken(data.oauth1, data.oauth2)
    await client.getUserSettings() // validiert / refresht
    return client
  }
  await client.login()
  return client
}

// Details-Endpoint: HF/Höhe/Distanz/Tempo-Zeitreihe einer einzelnen Aktivität.
async function fetchDetails(client, id) {
  const url = `https://connectapi.garmin.com/activity-service/activity/${id}/details?maxChartSize=4000`
  const d = await client.get(url)
  const descs = d?.metricDescriptors ?? []
  const idx = (key) => descs.find((m) => m.key === key)?.metricsIndex
  const hrI = idx('directHeartRate')
  const elapI = idx('sumElapsedDuration') ?? idx('sumDuration')
  const tsI = idx('directTimestamp')
  const elevI = idx('directElevation')
  const distI = idx('sumDistance')
  const spdI = idx('directSpeed')
  const rows = d?.activityDetailMetrics ?? []
  const t0 = tsI != null && rows.length ? rows[0].metrics[tsI] : null
  const samples = []
  let elevGain = 0
  let lastElev = null
  for (const r of rows) {
    const m = r.metrics
    const hr = hrI != null ? m[hrI] : null
    let tMin = null
    if (elapI != null && m[elapI] != null) tMin = m[elapI] / 60
    else if (tsI != null && t0 != null && m[tsI] != null) tMin = (m[tsI] - t0) / 60000
    if (tMin == null) continue
    const elev = elevI != null && m[elevI] != null ? Math.round(m[elevI] * 10) / 10 : null
    if (elev != null) {
      if (lastElev != null && elev > lastElev) elevGain += elev - lastElev
      lastElev = elev
    }
    samples.push({
      t: Math.round(tMin * 100) / 100,
      km: distI != null && m[distI] != null ? Math.round(m[distI] / 10) / 100 : null,
      hr: hr != null ? Math.round(hr) : null,
      elev,
      speed: spdI != null && m[spdI] != null ? Math.round(m[spdI] * 3.6 * 10) / 10 : null,
    })
  }
  return { samples, elevGain: Math.round(elevGain) }
}

async function fetchSummary(client, id) {
  const url = `https://connectapi.garmin.com/activity-service/activity/${id}`
  return client.get(url)
}

function record(id, parent, summary) {
  const dto = summary?.summaryDTO ?? {}
  return {
    id,
    parent,
    sport: summary?.activityTypeDTO?.typeKey ?? null,
    name: summary?.activityName ?? null,
    duration_min: dto.duration != null ? Math.round((dto.duration / 60) * 10) / 10 : null,
    distance_km: dto.distance != null ? Math.round(dto.distance / 10) / 100 : null,
    avg_hr: dto.averageHR ?? null,
    max_hr: dto.maxHR ?? null,
    elev_gain_m: dto.elevationGain != null ? Math.round(dto.elevationGain) : null,
  }
}

const client = await getClient()
const out = []

for (const id of ids) {
  const summary = await fetchSummary(client, id)
  const name = summary?.activityName ?? null
  const childIds = summary?.metadataDTO?.childIds ?? []

  if (childIds.length > 0) {
    console.error(`${id} (${name}) Multisport mit ${childIds.length} Disziplinen: ${childIds.join(', ')}`)
    for (const cid of childIds) {
      const cs = await fetchSummary(client, cid)
      const rec = record(cid, id, cs)
      const { samples, elevGain } = await fetchDetails(client, cid)
      if (rec.elev_gain_m == null) rec.elev_gain_m = elevGain
      out.push({ ...rec, samples })
      console.error(`  └ ${rec.sport} (${rec.name}): ${samples.length} Samples, +${rec.elev_gain_m}m`)
    }
  } else {
    const rec = record(id, null, summary)
    const { samples, elevGain } = await fetchDetails(client, id)
    if (rec.elev_gain_m == null) rec.elev_gain_m = elevGain
    out.push({ ...rec, samples })
    console.error(`${id} (${rec.name}, ${rec.sport}): ${samples.length} Samples, +${rec.elev_gain_m}m`)
  }
}

writeFileSync('scripts/.garmin-hr-out.json', JSON.stringify(out))
console.error('\nGeschrieben: scripts/.garmin-hr-out.json')

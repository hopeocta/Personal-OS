import { config } from 'dotenv'
config({ path: '.env.local' })
import { GarminConnect } from 'garmin-connect'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('garmin_auth').select('oauth1,oauth2').eq('user_id','p1').maybeSingle()
const client = new GarminConnect({ username: '', password: '' })
client.loadToken(data.oauth1, data.oauth2)
await client.getUserSettings()

const r = await client.get('https://connectapi.garmin.com/activity-service/activity/23246687349/splits')
const laps = r.lapDTOs ?? []

// Disziplin: Schwimm-Laps haben totalNumberOfStrokes > 0 (Garmin zählt Züge).
// Für Rad vs. Laufen: Rad > 16 km/h (4.45 m/s), darunter Laufen.
// averageSpeed (inkl. Stopps) statt averageMovingSpeed — stabiler im Wasser.
function disziplin(lap) {
  const spd    = lap.averageSpeed ?? 0
  const strokes = lap.totalNumberOfStrokes ?? 0
  if (spd < 0.4)    return 'T'
  if (strokes > 0)  return 'SWIM'
  if (spd < 4.45)   return 'RUN'
  return 'BIKE'
}

const totSec  = { SWIM: 0, BIKE: 0, RUN: 0, T: 0 }
const totDist = { SWIM: 0, BIKE: 0, RUN: 0 }
const hrNum   = { SWIM: 0, BIKE: 0, RUN: 0 }
const hrDen   = { SWIM: 0, BIKE: 0, RUN: 0 }

for (const lap of laps) {
  const d    = disziplin(lap)
  const dur  = lap.elapsedDuration ?? 0
  const dist = lap.distance ?? 0
  const hr   = lap.averageHR ?? 0

  if (d === 'T') { totSec.T += dur; continue }
  totSec[d]  += dur
  totDist[d] += dist
  if (hr > 0) { hrNum[d] += hr * dur; hrDen[d] += dur }
}

const fmt = s => `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')} min`
const avgHR = d => hrDen[d] > 0 ? Math.round(hrNum[d]/hrDen[d]) : '-'

console.log('\n=== Erlabrunn Triathlon — 14.06.2026 ===')
console.log(`Schwimmen  ${fmt(totSec.SWIM).padStart(10)}   ${(totDist.SWIM/1000).toFixed(2)} km   Ø HF ${avgHR('SWIM')}`)
console.log(`Transition ${fmt(totSec.T).padStart(10)}`)
console.log(`Rad        ${fmt(totSec.BIKE).padStart(10)}   ${(totDist.BIKE/1000).toFixed(2)} km   Ø HF ${avgHR('BIKE')}`)
console.log(`Laufen     ${fmt(totSec.RUN).padStart(10)}   ${(totDist.RUN/1000).toFixed(2)} km   Ø HF ${avgHR('RUN')}`)
console.log(`Gesamt     ${fmt(totSec.SWIM+totSec.BIKE+totSec.RUN+totSec.T).padStart(10)}`)
console.log(`Laps total: ${laps.length}`)
console.log()

// Geschwindigkeits-Verteilung für Debug
const spdBuckets = { SWIM: 0, RUN: 0, BIKE: 0, T: 0 }
for (const lap of laps) spdBuckets[disziplin(lap)]++
console.log('Lap-Verteilung:', spdBuckets)

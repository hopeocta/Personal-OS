// Einmaliges Garmin-Login-Setup pro Person.
// Speichert den OAuth-Token in garmin_auth und legt die Person in persons an.
// Das Passwort wird NICHT dauerhaft gespeichert — nur der Token (~1 Jahr gültig).
//
// Voraussetzung: npm run dev muss NICHT laufen. Das Script schreibt direkt in Supabase.
// .env.local muss NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY enthalten.
//
// Aufruf:
//   node scripts/garmin-setup-person.mjs --person p1 --email a@b.de --name "Max Mustermann"
//
// Optionen:
//   --person   user_id (z.B. p1, p2, p3) — PFLICHT
//   --email    Garmin-E-Mail — PFLICHT
//   --name     Anzeigename für das Dashboard (Standard = person-id)
//   --age      Alter der Person (optional, für spätere Plan-Generierung)
//   --hours    Verfügbare Trainingsstunden/Woche (z.B. 6)
//   --goal     Trainingsziel (z.B. "Triathlon Verbesserung", "Form aufbauen")
//   --sport    Sport-Fokus (z.B. "Triathlon")
//   --days     Verfügbare Wochentage, kommagetrennt (z.B. Mo,Di,Mi,Fr,Sa)
//
// Passwort: wird interaktiv abgefragt (versteckt, landet nicht in Shell-History).
// 2FA: falls Garmin einen Code per E-Mail/SMS schickt, wird ebenfalls interaktiv abgefragt.

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createInterface } from 'node:readline'
import { GarminConnect } from 'garmin-connect'
import { createClient } from '@supabase/supabase-js'

// --- Argumente parsen ---
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const PERSON  = arg('person', '')
const EMAIL   = arg('email', '')
const NAME    = arg('name', PERSON)
const HOURS   = arg('hours', null)
const GOAL    = arg('goal', null)
const SPORT   = arg('sport', 'Triathlon')
const DAYS_RAW = arg('days', null)

if (!PERSON || !EMAIL) {
  console.error('Fehler: --person und --email sind Pflichtfelder.')
  console.error('Beispiel: node scripts/garmin-setup-person.mjs --person p1 --email a@b.de --name "Max"')
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, output: process.stderr })

function prompt(question, hidden = false) {
  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      // Passwort-Eingabe: Echo unterdrücken
      process.stderr.write(question)
      process.stdin.setRawMode(true)
      process.stdin.resume()
      let pw = ''
      process.stdin.setEncoding('utf8')
      const onData = (ch) => {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.removeListener('data', onData)
          process.stderr.write('\n')
          resolve(pw)
        } else if (ch === '') {
          process.exit()
        } else if (ch === '' || ch === '\b') {
          if (pw.length > 0) pw = pw.slice(0, -1)
        } else {
          pw += ch
        }
      }
      process.stdin.on('data', onData)
    } else {
      rl.question(question, (answer) => resolve(answer))
    }
  })
}

// --- Supabase ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// --- Hauptprogramm ---
console.log('\n=== Garmin Setup: Person ' + PERSON + ' ===')
console.log('E-Mail: ' + EMAIL)
console.log('Name:   ' + NAME)
if (HOURS)    console.log('Stunden/Woche: ' + HOURS)
if (GOAL)     console.log('Ziel:   ' + GOAL)
console.log()

const password = await prompt('Garmin-Passwort (versteckt): ', true)

if (!password) {
  console.error('Kein Passwort eingegeben.')
  process.exit(1)
}

// --- Garmin-Login mit MFA-Hook ---
const client = new GarminConnect({ username: EMAIL, password })

// garmin-connect ruft diesen Callback auf, wenn ein MFA-Code benötigt wird.
// Die Bibliothek erwartet, dass wir den Code als String zurückgeben.
client.onMFACode = async () => {
  const code = await prompt('Garmin 2FA-Code (aus E-Mail/SMS): ')
  return code.trim()
}

console.log('\nVerbinde mit Garmin Connect...')
try {
  await client.login()
} catch (e) {
  console.error('Login fehlgeschlagen:', e.message)
  process.exit(1)
}
console.log('Login erfolgreich.')

// Token exportieren und in Supabase speichern
let tokens
try {
  tokens = client.exportToken()
} catch (e) {
  console.error('Token-Export fehlgeschlagen:', e.message)
  process.exit(1)
}

const { error: authErr } = await supabase
  .from('garmin_auth')
  .upsert(
    { user_id: PERSON, oauth1: tokens.oauth1, oauth2: tokens.oauth2, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )

if (authErr) {
  console.error('Fehler beim Speichern des Tokens:', authErr.message)
  process.exit(1)
}
console.log('Token gespeichert (garmin_auth, user_id=' + PERSON + ').')

// Person in persons-Tabelle anlegen / aktualisieren
const personRow = {
  id: PERSON,
  display_name: NAME,
  active: true,
  ...(HOURS ? { weekly_hours: parseFloat(HOURS) } : {}),
  ...(GOAL  ? { goal: GOAL } : {}),
  ...(SPORT ? { sport_focus: SPORT } : {}),
  ...(DAYS_RAW ? { available_days: DAYS_RAW.split(',').map(d => d.trim()) } : {}),
}

const { error: personErr } = await supabase
  .from('persons')
  .upsert(personRow, { onConflict: 'id' })

if (personErr) {
  console.error('Fehler beim Anlegen der Person:', personErr.message)
  process.exit(1)
}
console.log('Person angelegt/aktualisiert (persons, id=' + PERSON + ').')

// Kurzer Verbindungstest
try {
  const profile = await client.getUserProfile()
  const displayName = profile?.displayName ?? '(unbekannt)'
  console.log('Garmin-Profil: ' + displayName)
} catch (e) {
  console.warn('Profil-Abruf fehlgeschlagen (nicht kritisch):', e.message)
}

rl.close()

console.log('\n=== Fertig ===')
console.log('Nächster Schritt: Garmin-Cron triggern oder Backfill laufen lassen:')
console.log('  node scripts/garmin-backfill-sleep.mjs --person ' + PERSON + ' --days 30')
console.log()
console.log('Zeitbudget später anpassen:')
console.log('  --hours 6 --goal "Triathlon Verbesserung" --sport Triathlon --days "Mo,Mi,Fr,Sa"')

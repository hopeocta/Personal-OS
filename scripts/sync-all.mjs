// Lokaler Auto-Agent — DER Einstiegspunkt für den Windows-Scheduler.
// Führt nacheinander alle lokalen Sync-Schritte aus. Ein fehlgeschlagener Schritt
// stoppt die anderen nicht (jeder ist unabhängig, Daten bleiben in Supabase sicher).
//
// Schritte:
//   1. Garmin → Obsidian      (garmin-obsidian-sync.mjs)    Tagesdaten als MD
//   2. _Eingang → Obsidian+DB (eingang-ingest.mjs)          abgelegte Dateien einsortieren
//   3. Storage → Obsidian     (storage-obsidian-sync.mjs)   Telegram-Uploads spiegeln
//   4. Logbuch ← Supabase     (logbuch-sync.mjs)            Tageslog/Briefing/Pläne nachbauen
//   5. Knowledge ← Supabase   (knowledge-obsidian-sync.mjs) erfasste Notizen → Kategorie-Ordner
//   6. Wissen ↔ Supabase      (wissen-sync.mjs --import)    Aktiv/Archiv → context-Flag in Supabase
//   7. Revolut → Supabase     (analysis/revolut/auto_sync.py) Transaktionen abrufen → /finanzen
//
// Aufruf:  node scripts/sync-all.mjs
// Alle --flags werden an KEINEN Unter-Schritt durchgereicht (feste Defaults).
//
// Schritte mit `python: true` laufen über den py-Launcher (py -3.14), sonst über Node.
// Ein fehlender/abgelaufener Revolut-Session-Key lässt nur Schritt 7 fehlschlagen — der
// Rest läuft weiter (Schritte sind unabhängig).

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const steps = [
  { name: 'Garmin → Obsidian', script: 'garmin-obsidian-sync.mjs', args: [] },
  { name: '_Eingang → Obsidian + DB', script: 'eingang-ingest.mjs', args: [] },
  { name: 'Storage → Obsidian', script: 'storage-obsidian-sync.mjs', args: [] },
  { name: 'Logbuch ← Supabase', script: 'logbuch-sync.mjs', args: [] },
  { name: 'Knowledge ← Supabase', script: 'knowledge-obsidian-sync.mjs', args: [] },
  { name: 'Wissen ↔ Supabase (import)', script: 'wissen-sync.mjs', args: ['--import'] },
  { name: 'Revolut → Supabase', script: 'analysis/revolut/auto_sync.py', args: ['--days', '8'], python: true },
]

function run(step) {
  return new Promise((resolve) => {
    console.log(`\n########## ${step.name} ##########`)
    const cmd = step.python ? 'py' : process.execPath
    const scriptPath = step.python ? path.join(root, step.script) : path.join(here, step.script)
    const cmdArgs = step.python ? ['-3.14', scriptPath, ...step.args] : [scriptPath, ...step.args]
    const child = spawn(cmd, cmdArgs, {
      stdio: 'inherit',
      cwd: root,
    })
    child.on('close', (code) => {
      if (code !== 0) console.error(`!! ${step.name} endete mit Code ${code}`)
      resolve(code ?? 0)
    })
    child.on('error', (err) => {
      console.error(`!! ${step.name} konnte nicht starten: ${err.message}`)
      resolve(1)
    })
  })
}

let failures = 0
for (const step of steps) {
  const code = await run(step)
  if (code !== 0) failures++
}

console.log(`\n########## sync-all fertig — ${steps.length - failures}/${steps.length} ok ##########`)
process.exit(failures > 0 ? 1 : 0)

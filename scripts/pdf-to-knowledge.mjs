#!/usr/bin/env node
/**
 * PDF-Pipeline: Liest PDFs, teilt in Kapitel, sendet an /api/knowledge
 *
 * Aufruf:
 *   node scripts/pdf-to-knowledge.mjs --input ./pdfs --url https://mein-dashboard.vercel.app
 *
 * Optionen:
 *   --input,    -i  Ordner mit PDFs (Standard: ./pdfs)
 *   --url,      -u  Dashboard-URL (Pflicht)
 *   --secret,   -s  API_SECRET Wert (alternativ aus .env.local)
 *   --category, -c  Ziel-Kategorie (Standard: Zahnmedizin)
 *   --words,    -w  Wörter pro Chunk (Standard: 2000)
 *   --delay,    -d  ms zwischen Requests (Standard: 800)
 *   --dry-run       Nur parsen, nichts senden
 *   --scan          Vergleich: lokal vs. bereits importiert, dann Bestätigung
 */

import { readFileSync, readdirSync, existsSync, createInterface } from 'fs'
import { join, extname, basename } from 'path'
import { createInterface as rlInterface } from 'readline'
import dotenv from 'dotenv'
import { PDFParse } from 'pdf-parse'

// .env.local laden (API_SECRET steht dort)
dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ path: '.env', quiet: true })

// ── CLI-Argumente parsen ──────────────────────────────────────────────────────

const args = process.argv.slice(2)

function getArg(flags, defaultVal = null) {
  for (const flag of flags) {
    const i = args.indexOf(flag)
    if (i !== -1 && i + 1 < args.length) return args[i + 1]
  }
  return defaultVal
}

function hasFlag(flag) {
  return args.includes(flag)
}

const inputDir      = getArg(['--input',    '-i'], './pdfs')
const baseUrl       = getArg(['--url',      '-u'])
const secretArg     = getArg(['--secret',   '-s'], process.env.API_SECRET ?? '')
const category      = getArg(['--category', '-c'], 'Zahnmedizin')
const wordsPerChunk = parseInt(getArg(['--words', '-w'], '2000'), 10)
const delayMs       = parseInt(getArg(['--delay',   '-d'], '800'), 10)
const isDryRun      = hasFlag('--dry-run')
const isScan        = hasFlag('--scan')

// ── Validierung ───────────────────────────────────────────────────────────────

if (!baseUrl) {
  console.error('Fehler: --url ist Pflicht.')
  console.error('Beispiel: node scripts/pdf-to-knowledge.mjs --input ./pdfs --url https://mein-dashboard.vercel.app')
  process.exit(1)
}

if (!secretArg && !isDryRun) {
  console.error('Fehler: API_SECRET fehlt. Entweder in .env.local setzen oder --secret übergeben.')
  process.exit(1)
}

if (!existsSync(inputDir)) {
  console.error(`Fehler: Ordner nicht gefunden: ${inputDir}`)
  process.exit(1)
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function prompt(question) {
  const rl = rlInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans) }))
}

/**
 * Text in Chunks aufteilen — bevorzugt Absatzgrenzen,
 * Zielgröße: wordsPerChunk Wörter.
 */
function chunkText(text) {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const paragraphs = cleaned.split(/\n\n+/)
  const chunks = []
  let current = []
  let wordCount = 0

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue
    const words = trimmed.split(/\s+/).length
    if (wordCount + words > wordsPerChunk && current.length > 0) {
      chunks.push(current.join('\n\n'))
      current = [trimmed]
      wordCount = words
    } else {
      current.push(trimmed)
      wordCount += words
    }
  }

  if (current.length > 0) chunks.push(current.join('\n\n'))
  return chunks.filter(c => c.split(/\s+/).length >= 80)
}

/**
 * Bereits importierte PDF-Dateinamen vom Server holen.
 */
async function fetchImportedSources() {
  const url = `${baseUrl.replace(/\/$/, '')}/api/knowledge/sources`
  const res = await fetch(url, {
    headers: { 'x-api-secret': secretArg },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  // data = [{ filename, chunks }]
  return new Map(data.map(e => [e.filename, e.chunks]))
}

/**
 * Einen Chunk an /api/knowledge senden.
 */
async function postChunk(rawText, filename, chunkIndex, totalChunks) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/knowledge`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': secretArg,
    },
    body: JSON.stringify({
      raw_text: `[Quelle: ${filename} — Abschnitt ${chunkIndex + 1}/${totalChunks}]\n\n${rawText}`,
      category,
      source: `pdf:${filename}`,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(kein Body)')
    throw new Error(`HTTP ${res.status}: ${body}`)
  }
  return await res.json()
}

// ── PDF verarbeiten ───────────────────────────────────────────────────────────

async function processPdf(pdfPath) {
  const filename = basename(pdfPath)
  process.stdout.write(`\n📄 ${filename}\n`)

  let buffer
  try {
    buffer = readFileSync(pdfPath)
  } catch (err) {
    console.error(`   ✗ Datei lesen fehlgeschlagen: ${err.message}`)
    return { ok: 0, failed: 0, skipped: 1 }
  }

  let text, pageCount
  try {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    text = result.text
    pageCount = result.total
    await parser.destroy()
    const words = text.split(/\s+/).length
    process.stdout.write(`   ${pageCount} Seiten, ~${words.toLocaleString('de')} Wörter\n`)
  } catch (err) {
    console.error(`   ✗ PDF-Parse fehlgeschlagen: ${err.message}`)
    return { ok: 0, failed: 1, skipped: 0 }
  }

  const chunks = chunkText(text)
  process.stdout.write(`   ${chunks.length} Abschnitte à ~${wordsPerChunk} Wörter\n`)

  if (isDryRun) {
    for (let i = 0; i < chunks.length; i++) {
      const words = chunks[i].split(/\s+/).length
      const preview = chunks[i].slice(0, 80).replace(/\n/g, ' ')
      process.stdout.write(`   [${i + 1}/${chunks.length}] ${words} Wörter — "${preview}..."\n`)
    }
    return { ok: 0, failed: 0, skipped: chunks.length }
  }

  let ok = 0, failed = 0

  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`   Sende ${i + 1}/${chunks.length}...`)
    try {
      const entry = await postChunk(chunks[i], filename, i, chunks.length)
      process.stdout.write(` ✓ [${entry.category}] ${entry.summary?.slice(0, 60) ?? ''}\n`)
      ok++
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`)
      failed++
    }
    if (i < chunks.length - 1) await sleep(delayMs)
  }

  return { ok, failed, skipped: 0 }
}

// ── Scan-Modus ────────────────────────────────────────────────────────────────

async function runScan() {
  const allPdfs = readdirSync(inputDir)
    .filter(f => extname(f).toLowerCase() === '.pdf')

  if (allPdfs.length === 0) {
    console.error(`Keine PDFs gefunden in: ${inputDir}`)
    process.exit(1)
  }

  console.log(`\n🔍 Scanne Ordner: ${inputDir}`)
  console.log(`   ${allPdfs.length} PDF(s) gefunden\n`)
  process.stdout.write('   Prüfe Dashboard auf bereits importierte Quellen...')

  let imported
  try {
    imported = await fetchImportedSources()
    process.stdout.write(` ${imported.size} bereits importiert\n\n`)
  } catch (err) {
    process.stdout.write(` ✗ Fehler: ${err.message}\n`)
    process.exit(1)
  }

  const newPdfs = []
  const existingPdfs = []

  for (const filename of allPdfs) {
    if (imported.has(filename)) {
      existingPdfs.push({ filename, chunks: imported.get(filename) })
    } else {
      newPdfs.push(filename)
    }
  }

  // Bereits importierte anzeigen
  if (existingPdfs.length > 0) {
    console.log(`✅ Bereits importiert (${existingPdfs.length}):`)
    for (const { filename, chunks } of existingPdfs) {
      console.log(`   ${chunks.toString().padStart(4)} Abschnitte  ${filename}`)
    }
    console.log()
  }

  // Neue anzeigen
  if (newPdfs.length === 0) {
    console.log('✨ Alle PDFs sind bereits importiert. Nichts zu tun.\n')
    return
  }

  console.log(`🆕 Neue PDFs (${newPdfs.length}):`)
  for (const filename of newPdfs) {
    console.log(`   → ${filename}`)
  }
  console.log()

  const answer = await prompt(`Import starten für ${newPdfs.length} neue PDF(s)? [j/n] `)
  if (answer.trim().toLowerCase() !== 'j') {
    console.log('\nAbgebrochen.\n')
    return
  }

  // Nur neue importieren
  let totalOk = 0, totalFailed = 0

  for (const filename of newPdfs) {
    const { ok, failed } = await processPdf(join(inputDir, filename))
    totalOk += ok
    totalFailed += failed
  }

  console.log(`\n════════════════════════════════`)
  console.log(`✓ ${totalOk} Abschnitte gespeichert`)
  if (totalFailed > 0) console.log(`✗ ${totalFailed} Fehler`)
  console.log(`════════════════════════════════\n`)
  console.log(`Lernfach "Zahnmedizin" im Terminal neu laden um die Inhalte zu sehen.`)
}

// ── Standard-Modus ────────────────────────────────────────────────────────────

async function runAll() {
  const pdfs = readdirSync(inputDir)
    .filter(f => extname(f).toLowerCase() === '.pdf')
    .map(f => join(inputDir, f))

  if (pdfs.length === 0) {
    console.error(`Keine PDFs gefunden in: ${inputDir}`)
    process.exit(1)
  }

  console.log(`\n📚 PDF-Pipeline gestartet`)
  console.log(`   Ordner:    ${inputDir}`)
  console.log(`   URL:       ${baseUrl}`)
  console.log(`   Kategorie: ${category}`)
  console.log(`   Chunk-Größe: ~${wordsPerChunk} Wörter`)
  console.log(`   Delay:     ${delayMs}ms zwischen Requests`)
  if (isDryRun) console.log(`   TROCKENLAUF — nichts wird gesendet`)
  console.log(`   ${pdfs.length} PDF(s) gefunden\n`)

  let totalOk = 0, totalFailed = 0, totalSkipped = 0

  for (const pdfPath of pdfs) {
    const { ok, failed, skipped } = await processPdf(pdfPath)
    totalOk += ok
    totalFailed += failed
    totalSkipped += skipped
  }

  console.log(`\n════════════════════════════════`)
  if (isDryRun) {
    console.log(`Trockenlauf abgeschlossen`)
    console.log(`${totalSkipped} Abschnitte würden gesendet werden`)
  } else {
    console.log(`Pipeline abgeschlossen`)
    console.log(`✓ ${totalOk} Abschnitte gespeichert`)
    if (totalFailed > 0) console.log(`✗ ${totalFailed} Fehler`)
  }
  console.log(`════════════════════════════════\n`)
  console.log(`Lernfach "Zahnmedizin" im Terminal neu laden um die Inhalte zu sehen.`)
}

// ── Entry Point ───────────────────────────────────────────────────────────────

if (isScan) {
  runScan().catch(err => { console.error('\nFataler Fehler:', err); process.exit(1) })
} else {
  runAll().catch(err => { console.error('\nFataler Fehler:', err); process.exit(1) })
}

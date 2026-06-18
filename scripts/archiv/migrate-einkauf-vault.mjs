#!/usr/bin/env node
/**
 * Verschiebt Einkauf-Anschaffungen/ → Einkauf/
 *
 *   node scripts/migrate-einkauf-vault.mjs --dry-run --vault "D:\Obsidian Vault"
 */

import fs from 'fs'
import path from 'path'

const TARGET = 'Einkauf'
const SOURCES = ['Einkauf-Anschaffungen']

function argVal(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const VAULT = argVal('vault', 'D:\\Obsidian Vault')
const DRY_RUN = process.argv.includes('--dry-run')

function listFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...listFiles(abs))
    else out.push(abs)
  }
  return out
}

const targetAbs = path.join(VAULT, TARGET)
if (!DRY_RUN) fs.mkdirSync(targetAbs, { recursive: true })

let moved = 0
for (const srcRel of SOURCES) {
  const srcAbs = path.join(VAULT, ...srcRel.split('/'))
  for (const src of listFiles(srcAbs)) {
    const name = path.basename(src)
    const dest = path.join(targetAbs, name)
    if (DRY_RUN) {
      console.log(`${srcRel}/${name} → ${TARGET}/${name}`)
      moved++
      continue
    }
    if (fs.existsSync(dest)) {
      const ext = path.extname(name)
      const base = path.basename(name, ext)
      fs.renameSync(src, path.join(targetAbs, `${base}--legacy${ext}`))
    } else {
      fs.renameSync(src, dest)
    }
    console.log(`✓ ${name}`)
    moved++
  }
}

console.log(`\n${moved} Datei(en)${DRY_RUN ? ' (dry-run)' : ''}. Leeren Ordner ${SOURCES.join(', ')} manuell löschen.`)

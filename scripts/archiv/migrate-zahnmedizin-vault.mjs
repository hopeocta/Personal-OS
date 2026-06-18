#!/usr/bin/env node
/**
 * Verschiebt Dateien aus legacy Zahnmedizin-Ordnern nach Literatur/Medizin/Zahnmedizin.
 *
 * Quellen (werden geleert, Ordner danach manuell löschen):
 *   Vault/Zahnmedizin/
 *   Vault/Recherche/Zahnmedizin/
 *
 * Ziel:
 *   Vault/Literatur/Medizin/Zahnmedizin/
 *
 * Aufruf:
 *   node scripts/migrate-zahnmedizin-vault.mjs --dry-run
 *   node scripts/migrate-zahnmedizin-vault.mjs --vault "D:\Obsidian Vault"
 */

import fs from 'fs'
import path from 'path'

const TARGET_REL = 'Literatur/Medizin/Zahnmedizin'
const SOURCE_RELS = ['Zahnmedizin', 'Recherche/Zahnmedizin']

function argVal(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const VAULT = argVal('vault', 'D:\\Obsidian Vault')
const DRY_RUN = process.argv.includes('--dry-run')

function listFilesRecursive(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...listFilesRecursive(abs))
    else out.push(abs)
  }
  return out
}

function uniqueDestPath(destDir, fileName, sourceTag) {
  let dest = path.join(destDir, fileName)
  if (!fs.existsSync(dest)) return dest
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  const tagged = `${base}--from-${sourceTag}${ext}`
  dest = path.join(destDir, tagged)
  if (!fs.existsSync(dest)) return dest
  let n = 2
  while (fs.existsSync(dest)) {
    dest = path.join(destDir, `${base}--from-${sourceTag}-${n}${ext}`)
    n++
  }
  return dest
}

function main() {
  const targetAbs = path.join(VAULT, ...TARGET_REL.split('/'))
  if (!DRY_RUN) fs.mkdirSync(targetAbs, { recursive: true })

  console.log(`\n=== Zahnmedizin Vault-Migration ===`)
  console.log(`Vault:  ${VAULT}`)
  console.log(`Ziel:   ${TARGET_REL}`)
  console.log(`${DRY_RUN ? '(DRY-RUN — nichts verschoben)\n' : ''}`)

  let moved = 0
  let skipped = 0

  for (const srcRel of SOURCE_RELS) {
    const srcAbs = path.join(VAULT, ...srcRel.split('/'))
    if (!fs.existsSync(srcAbs)) {
      console.log(`Übersprungen (existiert nicht): ${srcRel}`)
      continue
    }

    const tag = srcRel.replace(/\//g, '-')
    const files = listFilesRecursive(srcAbs)
    console.log(`\n${srcRel}: ${files.length} Datei(en)`)

    for (const srcFile of files) {
      const relUnderSrc = path.relative(srcAbs, srcFile)
      const fileName = relUnderSrc.includes(path.sep)
        ? relUnderSrc.replace(/\\/g, '--')
        : path.basename(srcFile)

      const destFile = uniqueDestPath(targetAbs, fileName, tag)

      if (DRY_RUN) {
        console.log(`  → ${path.relative(VAULT, destFile)}`)
        moved++
        continue
      }

      fs.mkdirSync(path.dirname(destFile), { recursive: true })
      try {
        fs.renameSync(srcFile, destFile)
        console.log(`  ✓ ${fileName}`)
        moved++
      } catch (err) {
        console.error(`  ✗ ${fileName}: ${err.message}`)
        skipped++
      }
    }
  }

  console.log(`\nFertig: ${moved} verschoben${skipped ? `, ${skipped} Fehler` : ''}.`)
  if (!DRY_RUN && moved > 0) {
    console.log(
      `\nLeere Ordner manuell löschen (falls nichts mehr drin):\n` +
        SOURCE_RELS.map((r) => `  - ${r}`).join('\n'),
    )
  }
}

main()

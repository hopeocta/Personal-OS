// Erzeugt die PWA-/Apple-Touch-Icons (Hermes-Feder auf Clay) nach public/.
// Einmalig/ bei Designänderung ausführen: node scripts/gen-mobile-icons.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')

const CLAY = '#C0623B'
const CREAM = '#F7F1E8'

function svg(size) {
  const s = (size * 0.42) / 24 // Feder-Skalierung (zentriert, ~42% Kantenlänge)
  const c = size / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${CLAY}"/>
  <g transform="translate(${c} ${c}) scale(${s}) translate(-12 -12)" fill="none" stroke="${CREAM}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
    <path d="M16 8L2 22"/>
    <path d="M17.5 15H9"/>
  </g>
</svg>`
}

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of targets) {
  await sharp(Buffer.from(svg(size))).png().toFile(join(PUBLIC, name))
  console.log(`✓ ${name} (${size}px)`)
}

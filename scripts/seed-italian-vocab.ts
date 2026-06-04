// Ausführen mit: npx tsx scripts/seed-italian-vocab.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const THEMEN: { name: string; tags: string[]; count: number }[] = [
  { name: 'Alltag & Haushalt', tags: ['alltag'], count: 120 },
  { name: 'Essen & Trinken', tags: ['essen'], count: 100 },
  { name: 'Reisen & Transport', tags: ['reisen'], count: 120 },
  { name: 'Sport & Fitness', tags: ['sport'], count: 80 },
  { name: 'Medizin & Gesundheit', tags: ['medizin'], count: 80 },
  { name: 'Emotionen & Beziehungen', tags: ['emotionen'], count: 80 },
  { name: 'Arbeit & Beruf', tags: ['arbeit'], count: 80 },
  { name: 'Natur & Umwelt', tags: ['natur'], count: 80 },
  { name: 'Fortgeschrittene Verben & Phrasen', tags: ['verb', 'fortgeschritten'], count: 120 },
  { name: 'Abstrakte Begriffe & Akademisch', tags: ['abstrakt', 'fortgeschritten'], count: 140 },
]

async function generateVocab(topic: string, count: number, tags: string[], deckId: string) {
  if (count <= 0) {
    console.log(`Überspringe Thema "${topic}" (count=${count})`)
    return
  }

  // Prüfe ob IT→DE Karten für dieses Thema schon existieren
  const { count: existing } = await supabase
    .from('flashcards')
    .select('*', { count: 'exact', head: true })
    .eq('deck_id', deckId)
    .contains('tags', [...tags, 'it-de'])
  if ((existing ?? 0) > 0) {
    console.log(`  ⏭ Überspringe "${topic}" — ${existing} Karten bereits vorhanden`)
    return
  }

  console.log(`Generiere ${count} Vokabeln: ${topic}...`)

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `Erstelle ${count} italienische Vokabeln zum Thema "${topic}" für einen fortgeschrittenen Lerner (B1-C1 Niveau).
Format: JSON-Array, jedes Element:
{ "front": "italienisches Wort/Phrase", "back": "deutsche Übersetzung", "example": "kurzer Beispielsatz auf Italienisch" }
Nur das JSON-Array ausgeben, keine Erklärung.`,
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  let cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  if (!cleaned) {
    console.error(`⚠️ Leere Antwort von Claude für Thema "${topic}", überspringe.`)
    return
  }

  let vocab: { front: string; back: string; example: string }[] | null = null

  // 1. Versuch: direktes JSON.parse
  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Antwort ist kein JSON-Array')
    vocab = parsed
  } catch (err) {
    console.warn(`⚠️ Direktes JSON-Parse fehlgeschlagen für "${topic}", versuche Cleanup...`)
    console.warn('Fehler:', err instanceof Error ? err.message : String(err))

    // 2. Versuch: Zeilenumbrüche innerhalb von Objekt-Strings bereinigen
    const lines = cleaned.split('\n')
    const rebuilt: string[] = []
    let buffer = ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (
        trimmed.startsWith('{') ||
        trimmed.startsWith('[') ||
        trimmed.startsWith(']') ||
        trimmed === '},' ||
        trimmed === '}'
      ) {
        if (buffer) { rebuilt.push(buffer); buffer = '' }
        rebuilt.push(trimmed)
      } else {
        buffer = buffer ? buffer + ' ' + trimmed : trimmed
      }
    }
    if (buffer) rebuilt.push(buffer)
    cleaned = rebuilt.join('\n')

    try {
      const parsed2 = JSON.parse(cleaned)
      if (!Array.isArray(parsed2)) throw new Error('Antwort ist nach Cleanup kein JSON-Array')
      vocab = parsed2
    } catch (err2) {
      console.error(`❌ JSON-Parse-Fehler für Thema "${topic}" – wird übersprungen.`)
      console.error('Fehlermeldung:', err2 instanceof Error ? err2.message : String(err2))
      console.error('Antwort (Anfang):', cleaned.slice(0, 600))
      return
    }
  }

  if (!vocab || vocab.length === 0) {
    console.error(`⚠️ JSON für "${topic}" ist leer – wird übersprungen.`)
    return
  }

  // IT→DE Karten
  const rowsItDe = vocab.map((v) => ({
    deck_id: deckId,
    user_id: 'me',
    front: v.front ?? '',
    back: v.back ?? '',
    example_sentence: v.example ?? '',
    tags: [...tags, 'it-de'],
  }))

  // DE→IT Karten (front/back getauscht, kein Beispielsatz nötig)
  const rowsDeIt = vocab.map((v) => ({
    deck_id: deckId,
    user_id: 'me',
    front: v.back ?? '',
    back: v.front ?? '',
    example_sentence: v.example ?? '',
    tags: [...tags, 'de-it'],
  }))

  let insertedItDe = 0
  let insertedDeIt = 0

  for (let i = 0; i < rowsItDe.length; i += 50) {
    const { data, error } = await supabase
      .from('flashcards')
      .upsert(rowsItDe.slice(i, i + 50), { onConflict: 'deck_id,front', ignoreDuplicates: true })
      .select('id')
    if (error) console.error('Upsert IT→DE error:', error)
    else insertedItDe += data?.length ?? 0
  }
  for (let i = 0; i < rowsDeIt.length; i += 50) {
    const { data, error } = await supabase
      .from('flashcards')
      .upsert(rowsDeIt.slice(i, i + 50), { onConflict: 'deck_id,front', ignoreDuplicates: true })
      .select('id')
    if (error) console.error('Upsert DE→IT error:', error)
    else insertedDeIt += data?.length ?? 0
  }

  const skipped = rowsItDe.length - insertedItDe
  const skippedInfo = skipped > 0 ? ` (${skipped} bereits vorhanden, übersprungen)` : ''
  console.log(`  ✓ ${insertedItDe} IT→DE + ${insertedDeIt} DE→IT Karten für "${topic}"${skippedInfo}`)
}

async function main() {
  let deckId: string
  const { data: existing } = await supabase
    .from('flashcard_decks')
    .select('id')
    .eq('user_id', 'me')
    .eq('language', 'it')
    .maybeSingle()

  if (existing?.id) {
    deckId = existing.id
    console.log('Verwende bestehendes Deck:', deckId)
  } else {
    const { data, error } = await supabase
      .from('flashcard_decks')
      .insert({ user_id: 'me', name: 'Italiano', language: 'it', description: 'Italienisch-Wortschatz 1000+' })
      .select('id')
      .single()
    if (error) throw error
    deckId = data.id
    console.log('Neues Deck erstellt:', deckId)
  }

  for (const thema of THEMEN) {
    await generateVocab(thema.name, thema.count, thema.tags, deckId)
    await new Promise((r) => setTimeout(r, 1500))
  }

  console.log('\n✅ Alle Vokabeln generiert!')
}

main().catch((err) => {
  console.error('Globaler Fehler:', err)
})

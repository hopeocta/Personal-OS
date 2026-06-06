// Ausführen mit: npx tsx scripts/seed-italian-vocab.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' }) // Fallback: fehlende Vars aus .env nachladen

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

async function parseVocabFromClaude(raw: string, topic: string): Promise<{ front: string; back: string; example: string }[] | null> {
  let cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  if (!cleaned) {
    console.error(`⚠️ Leere Antwort von Claude für "${topic}", überspringe.`)
    return null
  }

  // 1. Versuch: direktes JSON.parse
  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('kein Array')
    return parsed
  } catch {
    // 2. Versuch: Zeilenumbrüche innerhalb Objekte bereinigen
    const lines = cleaned.split('\n')
    const rebuilt: string[] = []
    let buffer = ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith(']') || trimmed === '},' || trimmed === '}') {
        if (buffer) { rebuilt.push(buffer); buffer = '' }
        rebuilt.push(trimmed)
      } else {
        buffer = buffer ? buffer + ' ' + trimmed : trimmed
      }
    }
    if (buffer) rebuilt.push(buffer)
    try {
      const parsed2 = JSON.parse(rebuilt.join('\n'))
      if (!Array.isArray(parsed2)) throw new Error('kein Array')
      return parsed2
    } catch (err2) {
      console.error(`❌ JSON-Parse-Fehler für "${topic}":`, err2 instanceof Error ? err2.message : String(err2))
      console.error('Antwort (Anfang):', cleaned.slice(0, 400))
      return null
    }
  }
}

async function generateVocab(topic: string, count: number, tags: string[], deckId: string) {
  if (count <= 0) {
    console.log(`Überspringe Thema "${topic}" (count=${count})`)
    return
  }

  // IT→DE und DE→IT separat prüfen
  const { count: existingItDe } = await supabase
    .from('flashcards').select('*', { count: 'exact', head: true })
    .eq('deck_id', deckId).contains('tags', [...tags, 'it-de'])
  const { count: existingDeIt } = await supabase
    .from('flashcards').select('*', { count: 'exact', head: true })
    .eq('deck_id', deckId).contains('tags', [...tags, 'de-it'])

  const hasItDe = (existingItDe ?? 0) > 0
  const hasDeIt = (existingDeIt ?? 0) > 0

  if (hasItDe && hasDeIt) {
    console.log(`  ⏭ "${topic}" vollständig — IT→DE: ${existingItDe}, DE→IT: ${existingDeIt}`)
    return
  }

  let vocab: { front: string; back: string; example: string }[]

  if (hasItDe && !hasDeIt) {
    // IT→DE vorhanden, DE→IT fehlt → aus DB holen und umdrehen (kein Claude-Call nötig)
    console.log(`  ↩ "${topic}": IT→DE vorhanden (${existingItDe}), generiere DE→IT aus bestehenden Karten...`)
    const { data: existingCards } = await supabase
      .from('flashcards')
      .select('front, back, example_sentence')
      .eq('deck_id', deckId)
      .contains('tags', [...tags, 'it-de'])
    vocab = (existingCards ?? []).map((c) => ({
      front: c.front,
      back: c.back,
      example: c.example_sentence ?? '',
    }))
  } else {
    // IT→DE (und evtl. DE→IT) fehlen → Claude generiert
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
    const parsed = await parseVocabFromClaude(raw, topic)
    if (!parsed || parsed.length === 0) return
    vocab = parsed
  }

  // IT→DE Karten (nur wenn fehlend)
  const rowsItDe = hasItDe ? [] : vocab.map((v) => ({
    deck_id: deckId,
    user_id: 'me',
    front: v.front ?? '',
    back: v.back ?? '',
    example_sentence: v.example ?? '',
    tags: [...tags, 'it-de'],
  }))

  // DE→IT Karten (nur wenn fehlend, front/back getauscht)
  const rowsDeIt = hasDeIt ? [] : vocab.map((v) => ({
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

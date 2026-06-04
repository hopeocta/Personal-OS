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
  console.log(`Generiere ${count} Vokabeln: ${topic}...`)
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Erstelle ${count} italienische Vokabeln zum Thema "${topic}" für einen fortgeschrittenen Lerner (B1-C1 Niveau).
Format: JSON-Array, jedes Element:
{ "front": "italienisches Wort/Phrase", "back": "deutsche Übersetzung", "example": "kurzer Beispielsatz auf Italienisch" }
Nur das JSON-Array ausgeben, keine Erklärung.`,
    }],
  })
  const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const vocab: { front: string; back: string; example: string }[] = JSON.parse(cleaned)

  const rows = vocab.map((v) => ({
    deck_id: deckId,
    user_id: 'me',
    front: v.front,
    back: v.back,
    example_sentence: v.example,
    tags,
  }))

  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from('flashcards').insert(rows.slice(i, i + 50))
    if (error) console.error('Insert error:', error)
  }
  console.log(`  ✓ ${rows.length} Karten eingefügt`)
}

async function main() {
  let deckId: string
  const { data: existing } = await supabase.from('flashcard_decks').select('id').eq('user_id', 'me').eq('language', 'it').maybeSingle()
  if (existing?.id) {
    deckId = existing.id
    console.log('Verwende bestehendes Deck:', deckId)
  } else {
    const { data, error } = await supabase.from('flashcard_decks').insert({ user_id: 'me', name: 'Italiano', language: 'it', description: 'Italienisch-Wortschatz 1000+' }).select('id').single()
    if (error) throw error
    deckId = data.id
    console.log('Neues Deck erstellt:', deckId)
  }

  for (const thema of THEMEN) {
    await generateVocab(thema.name, thema.count, thema.tags, deckId)
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.log('\n✅ Alle Vokabeln generiert!')
}

main().catch(console.error)

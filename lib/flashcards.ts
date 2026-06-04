import 'server-only'
import { supabaseAdmin } from './supabaseAdmin'

export interface Flashcard {
  id: string
  deck_id: string
  front: string
  back: string
  example_sentence: string | null
  tags: string[]
  ease_factor: number
  interval_days: number
  repetitions: number
  due_date: string
}

export interface FlashcardDeck {
  id: string
  name: string
  language: string
  description: string | null
}

// ── SM-2 Algorithmus ──────────────────────────────────────────────────────────
// quality: 0=falsch, 1=schwer, 2=gut, 3=perfekt

export function sm2(
  easeFactor: number,
  intervalDays: number,
  repetitions: number,
  quality: 0 | 1 | 2 | 3,
): { easeFactor: number; intervalDays: number; repetitions: number } {
  if (quality < 2) {
    // Falsch oder sehr schwer → zurück auf Anfang
    return { easeFactor: Math.max(1.3, easeFactor - 0.2), intervalDays: 1, repetitions: 0 }
  }
  const newEase = Math.max(1.3, easeFactor + 0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02))
  let newInterval: number
  if (repetitions === 0) newInterval = 1
  else if (repetitions === 1) newInterval = 3
  else newInterval = Math.round(intervalDays * newEase)
  return { easeFactor: newEase, intervalDays: newInterval, repetitions: repetitions + 1 }
}

// ── Karten abrufen ────────────────────────────────────────────────────────────

export async function getDueCards(limit = 20): Promise<Flashcard[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('flashcards')
    .select('id, deck_id, front, back, example_sentence, tags, ease_factor, interval_days, repetitions, due_date')
    .eq('user_id', 'me')
    .lte('due_date', today)
    .order('due_date', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Flashcard[]
}

export async function getDueCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const { count, error } = await supabaseAdmin
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', 'me')
    .lte('due_date', today)
  if (error) throw error
  return count ?? 0
}

// ── Karte bewerten ────────────────────────────────────────────────────────────

export async function reviewCard(cardId: string, quality: 0 | 1 | 2 | 3): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('flashcards')
    .select('ease_factor, interval_days, repetitions')
    .eq('id', cardId)
    .single()
  if (error || !data) throw error ?? new Error('Card not found')

  const next = sm2(data.ease_factor, data.interval_days, data.repetitions, quality)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + next.intervalDays)

  const { error: updateError } = await supabaseAdmin
    .from('flashcards')
    .update({
      ease_factor: next.easeFactor,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      due_date: dueDate.toISOString().slice(0, 10),
      last_reviewed_at: new Date().toISOString(),
    })
    .eq('id', cardId)
  if (updateError) throw updateError
}

// ── Karte hinzufügen ──────────────────────────────────────────────────────────

export async function addCard(params: {
  deckId: string
  front: string
  back: string
  exampleSentence?: string
  tags?: string[]
}): Promise<void> {
  const { error } = await supabaseAdmin.from('flashcards').insert({
    deck_id: params.deckId,
    user_id: 'me',
    front: params.front,
    back: params.back,
    example_sentence: params.exampleSentence ?? null,
    tags: params.tags ?? [],
  })
  if (error) throw error
}

// ── Deck abrufen ──────────────────────────────────────────────────────────────

export async function getDecks(): Promise<FlashcardDeck[]> {
  const { data, error } = await supabaseAdmin
    .from('flashcard_decks')
    .select('id, name, language, description')
    .eq('user_id', 'me')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as FlashcardDeck[]
}

export async function getOrCreateItalianDeck(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('flashcard_decks')
    .select('id')
    .eq('user_id', 'me')
    .eq('language', 'it')
    .maybeSingle()
  if (data?.id) return data.id
  const { data: created, error } = await supabaseAdmin
    .from('flashcard_decks')
    .insert({ user_id: 'me', name: 'Italiano', language: 'it', description: 'Italienisch-Wortschatz aufbauen' })
    .select('id')
    .single()
  if (error) throw error
  return created.id as string
}

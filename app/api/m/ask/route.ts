import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { embedText } from '@/lib/embeddings'
import { owlChat, type ChatMessage } from '@/lib/openrouter'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const question: string = typeof body.question === 'string' ? body.question.trim() : ''
  const history: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(body.history)
    ? body.history
    : []

  if (!question) return NextResponse.json({ error: 'Keine Frage' }, { status: 400 })

  // RAG: Top-3 Treffer als Kontext injizieren
  let ragContext = ''
  try {
    const embedding = await embedText(question)
    const { data: hits } = await supabaseAdmin.rpc('match_knowledge', {
      query_embedding: embedding,
      match_count: 3,
      min_similarity: 0.3,
    })
    if (Array.isArray(hits) && hits.length > 0) {
      ragContext =
        '\n\nRELEVANTE EINTRÄGE AUS DEINER WISSENSBASIS:\n' +
        (hits as { title?: string; raw_text?: string; summary?: string }[])
          .map((h, i) => `[${i + 1}] ${h.title ?? ''}: ${(h.raw_text ?? h.summary ?? '').slice(0, 400)}`)
          .join('\n')
    }
  } catch {
    // RAG optional — bei Fehler ohne Kontext weiter
  }

  const systemPrompt = `Du bist Hermes, ein persönlicher KI-Assistent.
Beantworte Fragen kurz, präzise und auf Deutsch.
Wenn Informationen aus der Wissensbasis vorhanden sind, nutze sie.${ragContext}`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: question },
  ]

  const answer = await owlChat(messages, { maxTokens: 1024 })
  return NextResponse.json({ text: answer })
}

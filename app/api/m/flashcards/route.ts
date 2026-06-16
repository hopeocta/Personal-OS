import { NextRequest, NextResponse } from 'next/server'
import { getDueCards, getDueCount, reviewCard } from '@/lib/flashcards'

export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  try {
    const [cards, due] = await Promise.all([getDueCards(1), getDueCount()])
    const card = cards[0] ?? null
    return NextResponse.json({ card, due })
  } catch (e) {
    console.error('[m/flashcards] GET error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { cardId: string; quality: 0 | 1 | 2 | 3 }
    if (!body.cardId || body.quality == null) {
      return NextResponse.json({ error: 'cardId + quality required' }, { status: 400 })
    }
    await reviewCard(body.cardId, body.quality)
    const [cards, due] = await Promise.all([getDueCards(1), getDueCount()])
    return NextResponse.json({ card: cards[0] ?? null, due })
  } catch (e) {
    console.error('[m/flashcards] POST error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

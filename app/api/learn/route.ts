import { NextRequest, NextResponse } from 'next/server'
import { getDueCards, reviewCard } from '@/lib/flashcards'

// GET /api/learn — gibt fällige Karten zurück
export async function GET(): Promise<NextResponse> {
  try {
    const cards = await getDueCards(20)
    return NextResponse.json({ cards })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/learn — Karte bewerten
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { cardId, quality } = await req.json()
    if (!cardId || quality === undefined) {
      return NextResponse.json({ error: 'cardId and quality required' }, { status: 400 })
    }
    await reviewCard(cardId, quality as 0 | 1 | 2 | 3)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

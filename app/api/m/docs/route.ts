import { NextRequest, NextResponse } from 'next/server'
import { searchDocuments } from '@/lib/telegram'

// Dokument-Suche (nur Treffer, kein Versand) für den Hermes-Tab.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ hits: [] })
  try {
    const hits = await searchDocuments(q)
    return NextResponse.json({ hits })
  } catch (err) {
    console.error('[m/docs] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

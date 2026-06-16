import { NextRequest, NextResponse } from 'next/server'
import { sendDocumentToTelegram } from '@/lib/telegram'

// Schickt ein gefundenes Dokument an den festen Telegram-User.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id: string | undefined = body?.id
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const { summary } = await sendDocumentToTelegram(id)
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('[m/send-doc] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

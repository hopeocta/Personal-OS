import { NextRequest, NextResponse } from 'next/server'
import { getDueCount } from '@/lib/flashcards'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_USER_CHAT_ID
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const count = await getDueCount()
    if (count === 0) return NextResponse.json({ ok: true, due: 0 })

    const msg = `📚 Heute fällig: *${count} Vokabel${count === 1 ? '' : 'n'}*\n\nTippe /lernen um zu starten.`
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' }),
    })
    return NextResponse.json({ ok: true, due: count })
  } catch (err) {
    console.error('[flashcard cron] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

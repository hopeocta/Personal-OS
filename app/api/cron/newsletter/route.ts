import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyNewsletter, runMonthlyReview } from '@/lib/newsletter'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_USER_ID
const CRON_SECRET = process.env.CRON_SECRET

async function sendTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
  })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get('type') ?? 'weekly'

  try {
    if (type === 'weekly') {
      const msg = await runWeeklyNewsletter()
      await sendTelegram(msg)
      return NextResponse.json({ ok: true, type: 'weekly' })
    }

    if (type === 'monthly') {
      const review = await runMonthlyReview()
      if (review) await sendTelegram(`📚 *Monatlicher Literaturrückblick*\n\n${review.slice(0, 3000)}`)
      return NextResponse.json({ ok: true, type: 'monthly' })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err) {
    console.error('[newsletter cron] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

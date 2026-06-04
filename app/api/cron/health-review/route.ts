import { NextRequest, NextResponse } from 'next/server'
import { runHealthReview, type ReviewPeriod } from '@/lib/healthReview'
import { sendTelegramMessage } from '@/lib/telegramSend'

export const maxDuration = 60

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = (req.nextUrl.searchParams.get('type') ?? 'monthly') as ReviewPeriod
  const valid: ReviewPeriod[] = ['monthly', 'halfyear', 'annual']
  if (!valid.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  try {
    const result = await runHealthReview(type)
    await sendTelegramMessage(result)
    return NextResponse.json({ ok: true, type })
  } catch (err) {
    console.error('[health-review cron] error:', err)
    await sendTelegramMessage(`❌ Gesundheitsanalyse (${type}) fehlgeschlagen: ${String(err)}`)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

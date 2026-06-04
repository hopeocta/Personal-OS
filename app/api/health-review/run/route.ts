import { NextRequest, NextResponse } from 'next/server'
import { runHealthReview, type ReviewPeriod } from '@/lib/healthReview'
import { sendTelegramMessage } from '@/lib/telegramSend'

export const maxDuration = 60

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}))
  const type = (body.type ?? 'monthly') as ReviewPeriod
  const valid: ReviewPeriod[] = ['monthly', 'halfyear', 'annual']
  if (!valid.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  try {
    const result = await runHealthReview(type)
    void sendTelegramMessage(result)
    return NextResponse.json({ ok: true, type, message: result })
  } catch (err) {
    console.error('[health-review/run] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

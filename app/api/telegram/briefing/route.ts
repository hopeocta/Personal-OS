import { NextRequest, NextResponse } from 'next/server'
import { buildMorningBriefing } from '@/lib/briefing'
import { buildWeeklyTrainingSummary } from '@/lib/weeklyTraining'
import { saveMorningBriefing, saveWeeklyTraining } from '@/lib/briefingStore'
import { sendTelegramMessage } from '@/lib/telegramSend'
import { isoWeekKey } from '@/lib/berlinDate'

export const runtime = 'nodejs'
export const maxDuration = 30

async function runMorning(): Promise<NextResponse> {
  const result = await buildMorningBriefing()
  await saveMorningBriefing(result.dateKey, result.markdown)
  const sent = await sendTelegramMessage(result.telegramText)
  return NextResponse.json({ ok: true, type: 'morning', date: result.dateKey, telegram: sent })
}

async function runWeeklyTraining(): Promise<NextResponse> {
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)
  const weekKey = isoWeekKey(lastWeek)
  const result = await buildWeeklyTrainingSummary(weekKey)
  await saveWeeklyTraining(result.weekKey, result.markdown)
  const sent = await sendTelegramMessage(result.telegramText)
  return NextResponse.json({ ok: true, type: 'weekly-training', week: result.weekKey, telegram: sent })
}

async function handleBriefing(type: string | null): Promise<NextResponse> {
  try {
    if (type === 'morning') return runMorning()
    if (type === 'weekly-training') return runWeeklyTraining()
    return NextResponse.json(
      { error: 'type must be morning or weekly-training' },
      { status: 400 },
    )
  } catch (err) {
    console.error('[briefing] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const type = req.nextUrl.searchParams.get('type')
  return handleBriefing(type)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const type = typeof body.type === 'string' ? body.type : null
  return handleBriefing(type)
}

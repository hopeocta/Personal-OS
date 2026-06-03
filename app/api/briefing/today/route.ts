import { NextResponse } from 'next/server'
import { buildMorningBriefing } from '@/lib/briefing'

export const runtime = 'nodejs'

/** Liefert das Morgen-Briefing für die Home-Karte (nur Supabase/Kalender, kein Claude). */
export async function GET() {
  try {
    const result = await buildMorningBriefing()
    return NextResponse.json({
      date: result.dateKey,
      markdown: result.markdown,
      telegramText: result.telegramText,
    })
  } catch (err) {
    console.error('[briefing/today] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

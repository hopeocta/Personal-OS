import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendTelegramMessage } from '@/lib/telegramSend'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

const anthropic = new Anthropic()

function prevMonth(): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const month = prevMonth()

    const { data: summaries, error } = await supabaseAdmin
      .from('expense_summaries')
      .select('category, total_eur, transaction_count')
      .eq('month', month)
      .order('total_eur', { ascending: false })

    if (error) throw new Error(error.message)

    if (!summaries || summaries.length === 0) {
      await sendTelegramMessage(
        `💰 *Finanzbericht ${month}*\n\nKeine Daten für ${month}.\n\n` +
        `Enable Banking aktiv? → \`python analysis/revolut/auto_sync.py --days 35\`\n` +
        `Oder CSV-Fallback: \`python analysis/revolut/sync.py export.csv\``
      )
      return NextResponse.json({ ok: true, month, skipped: true })
    }

    const total = summaries.reduce((sum, r) => sum + r.total_eur, 0)
    const summaryText = summaries
      .map((r) => `- ${r.category}: ${r.total_eur.toFixed(0)} € (${r.transaction_count}x)`)
      .join('\n')

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Du erstellst einen kurzen Finanz-Kommentar für einen Medizinstudenten.
Schreibe 2-3 Sätze auf Deutsch: Was fällt auf? Wo könnte gespart werden?
Sei direkt und konkret, kein Bullshit.`,
      messages: [
        {
          role: 'user',
          content: `Monat: ${month}\nGesamtausgaben: ${total.toFixed(0)} €\n\nNach Kategorie:\n${summaryText}`,
        },
      ],
    })

    const comment =
      msg.content[0]?.type === 'text' ? msg.content[0].text : ''

    const telegram = `💰 *Finanzbericht ${month}*\n\nGesamt: *${total.toFixed(0)} €*\n\n${summaryText}\n\n💡 ${comment}`
    await sendTelegramMessage(telegram)

    return NextResponse.json({ ok: true, month, total })
  } catch (err) {
    console.error('[cron/finanzen] error:', err)
    await sendTelegramMessage(`❌ Finanzbericht fehlgeschlagen: ${String(err)}`)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

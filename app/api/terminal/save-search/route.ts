import { NextRequest, NextResponse } from 'next/server'
import { saveKnowledgeEntry } from '@/lib/knowledge'
import { appendToDailyLog, berlinNow } from '@/lib/obsidian'
import { berlinDateKey } from '@/lib/berlinDate'

export const runtime = 'nodejs'

/** Speichert eine Terminal-Suchantwort als Wissenseintrag + Logbuch-Zeile. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : 'Allgemein'

  if (!question || !answer) {
    return NextResponse.json({ error: 'Frage und Antwort erforderlich' }, { status: 400 })
  }

  const raw_text = `## Frage\n${question}\n\n## Antwort\n${answer}`
  const summary = question.slice(0, 100)

  try {
    const entry = await saveKnowledgeEntry({
      raw_text,
      source: 'terminal_search',
      category,
    })
    const { timeBerlin } = berlinNow()
    void appendToDailyLog({
      kind: 'note',
      timeBerlin,
      dateKey: berlinDateKey(),
      content: `Suche: ${summary}`,
    })
    return NextResponse.json({ ok: true, id: entry.id })
  } catch (err) {
    console.error('[terminal/save-search] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

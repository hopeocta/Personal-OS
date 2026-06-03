import { NextRequest, NextResponse } from 'next/server'
import { answerQuestion } from '@/lib/answer'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const searchCategory =
    typeof body.category === 'string' && body.category.trim() ? body.category.trim() : undefined
  if (!question) {
    return NextResponse.json({ error: 'Keine Frage angegeben' }, { status: 400 })
  }
  try {
    const result = await answerQuestion(question, { searchCategory })
    return NextResponse.json({ text: result.text })
  } catch (err) {
    console.error('[ask] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

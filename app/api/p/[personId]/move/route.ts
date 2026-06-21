import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST /api/p/[personId]/move  { sessionId, date: 'YYYY-MM-DD' }
// Verschiebt eine geplante Einheit per Drag-and-Drop auf einen anderen Tag.
// Kein Auth (gleiches Modell wie /done) — die PWA ist eine reine Person-Ansicht.
export async function POST(req: NextRequest, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params
  const { sessionId, date } = await req.json().catch(() => ({}))

  if (!sessionId) return NextResponse.json({ error: 'sessionId fehlt' }, { status: 400 })
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date muss YYYY-MM-DD sein' }, { status: 400 })
  }

  const { data: row } = await supabaseAdmin
    .from('training_plan_sessions')
    .select('id, date')
    .eq('id', sessionId)
    .eq('user_id', personId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 })

  // Ans Ende des Zieltags einsortieren (höchste sort_order + 10).
  const { data: sameDay } = await supabaseAdmin
    .from('training_plan_sessions')
    .select('sort_order')
    .eq('user_id', personId)
    .eq('date', date)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextSort = ((sameDay?.[0]?.sort_order as number | undefined) ?? -10) + 10

  const { error } = await supabaseAdmin
    .from('training_plan_sessions')
    .update({ date, sort_order: nextSort })
    .eq('id', sessionId)
    .eq('user_id', personId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, date })
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// POST /api/p/[personId]/done  { sessionId, done: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params
  const { sessionId, done } = await req.json().catch(() => ({}))
  if (!sessionId) return NextResponse.json({ error: 'sessionId fehlt' }, { status: 400 })

  const { data: row } = await supabaseAdmin
    .from('training_plan_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', personId)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('training_plan_sessions')
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq('id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, done })
}

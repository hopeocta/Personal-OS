import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// PATCH /api/training/session
// Body: { id: string, date: string }   ← YYYY-MM-DD
// Verschiebt eine training_plan_sessions-Einheit auf ein neues Datum.
export async function PATCH(req: NextRequest) {
  let body: { id?: string; date?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, date } = body
  if (!id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'id und date (YYYY-MM-DD) erforderlich' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('training_plan_sessions')
    .update({ date })
    .eq('id', id)
    .eq('user_id', 'me')

  if (error) {
    console.error('[training/session] PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id, date })
}

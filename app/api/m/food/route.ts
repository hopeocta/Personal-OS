import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Hängt einen Essens-Eintrag an die Tagesnotiz an, statt sie zu überschreiben.
// Andere Felder (Kalorien/Makros) bleiben unangetastet (upsert nur mit notes).
function berlinDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}
function berlinTime(): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(
    new Date(),
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const text: string | undefined = body?.text
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const date = berlinDate()
  const line = `${berlinTime()} ${text.trim()}`

  const { data: existing, error: readErr } = await supabaseAdmin
    .from('nutrition_logs')
    .select('notes')
    .eq('date', date)
    .maybeSingle()

  if (readErr) {
    console.error('[m/food] read error:', readErr)
    return NextResponse.json({ error: readErr.message }, { status: 500 })
  }

  const notes = existing?.notes ? `${existing.notes}\n${line}` : line

  const { data, error } = await supabaseAdmin
    .from('nutrition_logs')
    .upsert({ date, notes, user_id: 'me' }, { onConflict: 'date' })
    .select()
    .single()

  if (error) {
    console.error('[m/food] write error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

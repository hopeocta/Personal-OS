import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Geplante Einheiten für die "Nächste N Tage"-Ansicht. Liest NUR aus Supabase.
function berlinToday(): string {
  // YYYY-MM-DD in Europa/Berlin (kein Server-UTC-Offset an der Tagesgrenze)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}

export async function GET(req: NextRequest) {
  const days = Math.min(31, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10)))
  const today = berlinToday()
  // `past=7` → letzte N Tage statt nächste N Tage (für Training7Days-Rückblick)
  const pastParam = req.nextUrl.searchParams.get('past')
  let from: string
  let to: string
  if (pastParam) {
    const pastDays = Math.min(31, Math.max(1, parseInt(pastParam, 10)))
    const fromDate = new Date(today + 'T12:00:00Z')
    fromDate.setUTCDate(fromDate.getUTCDate() - pastDays + 1)
    from = fromDate.toISOString().split('T')[0]
    to = today
  } else {
    from = today
    const toDate = new Date(from + 'T12:00:00Z')
    toDate.setUTCDate(toDate.getUTCDate() + days - 1)
    to = toDate.toISOString().split('T')[0]
  }

  const { data, error } = await supabaseAdmin
    .from('training_plan_sessions')
    .select('*')
    .eq('user_id', 'me')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[training/plan] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ from, to, sessions: data ?? [] })
}

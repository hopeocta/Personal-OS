import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const dateRes = await supabaseAdmin
    .from('garmin_activities')
    .select('date')
    .eq('user_id', 'me')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (dateRes.error) {
    console.error('[garmin/last-activity] error:', dateRes.error)
    return NextResponse.json({ error: dateRes.error.message }, { status: 500 })
  }

  if (!dateRes.data) return NextResponse.json({ activities: [], date: null })

  const latestDate = String(dateRes.data.date)

  const { data, error } = await supabaseAdmin
    .from('garmin_activities')
    .select('*')
    .eq('user_id', 'me')
    .eq('date', latestDate)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[garmin/last-activity] activities error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ activities: data ?? [], date: latestDate })
}

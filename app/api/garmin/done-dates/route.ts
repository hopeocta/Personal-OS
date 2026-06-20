import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 14)
  const { data, error } = await supabaseAdmin
    .from('garmin_activities')
    .select('date, type')
    .eq('user_id', 'me')
    .gte('date', cutoff.toISOString().slice(0, 10))
  if (error) console.error('[done-dates]', error)
  return NextResponse.json(data ?? [])
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('daily_habits')
    .select('*')
    .eq('date', date)

  if (error) {
    console.error('[habits] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, habit_name, completed } = body

  if (!date || !habit_name) {
    return NextResponse.json({ error: 'date and habit_name required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('daily_habits')
    .upsert(
      { date, habit_name, completed, user_id: 'me' },
      { onConflict: 'date,habit_name' }
    )
    .select()
    .single()

  if (error) {
    console.error('[habits] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('nutrition_logs')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (error) {
    console.error('[nutrition] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, calories, protein_g, carbs_g, fat_g, notes } = body

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('nutrition_logs')
    .upsert(
      { date, calories, protein_g, carbs_g, fat_g, notes, user_id: 'me' },
      { onConflict: 'date' }
    )
    .select()
    .single()

  if (error) {
    console.error('[nutrition] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

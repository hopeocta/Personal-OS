import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('strength_sessions')
    .select('*')
    .gte('date', cutoffStr)
    .order('date', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[strength] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, intensity, session_type, notes } = body

  if (!date || !intensity) {
    return NextResponse.json({ error: 'date and intensity required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('strength_sessions')
    .insert({ date, intensity, session_type, notes, user_id: 'me' })
    .select()
    .single()

  if (error) {
    console.error('[strength] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

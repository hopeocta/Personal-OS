import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('music_projects')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[musik/projects] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, bpm, musical_key, scale, genre, mood, status, collab, notes } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('music_projects')
    .insert({
      title: title.trim(),
      bpm: bpm ? Number(bpm) : null,
      musical_key: musical_key?.trim() || null,
      scale: scale?.trim() || null,
      genre: genre?.trim() || null,
      mood: mood?.trim() || null,
      status: status ?? 'idea',
      collab: collab?.trim() || null,
      notes: notes?.trim() || null,
      user_id: 'me',
    })
    .select()
    .single()

  if (error) {
    console.error('[musik/projects] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const bpm_min = searchParams.get('bpm_min')
  const bpm_max = searchParams.get('bpm_max')
  const key = searchParams.get('key')
  const tag = searchParams.get('tag')

  let query = supabaseAdmin
    .from('sound_library')
    .select('*')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (search) query = query.or(`name.ilike.%${search}%,musical_key.ilike.%${search}%`)
  if (bpm_min) query = query.gte('bpm', parseInt(bpm_min))
  if (bpm_max) query = query.lte('bpm', parseInt(bpm_max))
  if (key) query = query.eq('musical_key', key)
  if (tag) query = query.contains('tags', [tag])

  const { data, error } = await query

  if (error) {
    console.error('[musik/sounds] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, category, subcategory, tags, bpm, musical_key, file_path, notes } = body

  if (!name?.trim() || !category?.trim()) {
    return NextResponse.json({ error: 'name and category required' }, { status: 400 })
  }

  const parsedTags = typeof tags === 'string'
    ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : Array.isArray(tags) ? tags : null

  const { data, error } = await supabaseAdmin
    .from('sound_library')
    .insert({
      name: name.trim(),
      category: category.trim(),
      subcategory: subcategory?.trim() || null,
      tags: parsedTags?.length ? parsedTags : null,
      bpm: bpm ? Number(bpm) : null,
      musical_key: musical_key?.trim() || null,
      file_path: file_path?.trim() || null,
      notes: notes?.trim() || null,
      user_id: 'me',
    })
    .select()
    .single()

  if (error) {
    console.error('[musik/sounds] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

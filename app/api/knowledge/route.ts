import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { saveKnowledgeEntry } from '@/lib/knowledge'

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  const search = req.nextUrl.searchParams.get('search')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200)

  let query = supabaseAdmin
    .from('knowledge_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category && category !== 'Alle') {
    query = query.eq('category', category)
  }

  if (search) {
    query = query.or(`raw_text.ilike.%${search}%,summary.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[knowledge] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { raw_text, source, category } = body

  if (!raw_text?.trim()) {
    return NextResponse.json({ error: 'raw_text required' }, { status: 400 })
  }

  try {
    const entry = await saveKnowledgeEntry({ raw_text, source, category })
    return NextResponse.json(entry)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

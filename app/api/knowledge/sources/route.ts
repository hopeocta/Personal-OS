import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('source')
    .like('source', 'pdf:%')

  if (error) {
    console.error('[knowledge/sources] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Count entries per PDF filename
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const filename = row.source.replace(/^pdf:/, '')
    counts[filename] = (counts[filename] ?? 0) + 1
  }

  const sources = Object.entries(counts).map(([filename, chunks]) => ({
    filename,
    chunks,
  }))

  return NextResponse.json(sources)
}

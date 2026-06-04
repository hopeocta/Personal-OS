import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('id, summary, source, tags, created_at')
    .like('source', 'health_review_%')
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    console.error('[analyse/recent] error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }

  const reviews = (data ?? []).map((r) => {
    const period = r.source?.replace('health_review_', '') ?? ''
    const label = r.tags?.find((t: string) => /^\d{4}/.test(t)) ?? ''
    const vaultFolder = period === 'monthly' ? 'Monatsberichte' : period === 'halfyear' ? 'Halbjährig' : 'Jahresberichte'
    return {
      id: r.id,
      summary: r.summary,
      period,
      label,
      obsidianPath: `Gesundheit & Training/${vaultFolder}/${label}.md`,
      createdAt: r.created_at,
    }
  })

  return NextResponse.json({ reviews })
}

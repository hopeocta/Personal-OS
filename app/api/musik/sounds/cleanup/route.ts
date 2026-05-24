import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// DELETE — remove duplicate rows from sound_library, keep the oldest (first imported) per file_path
export async function DELETE() {
  // Find all duplicate IDs: for each file_path, keep the row with the smallest created_at, delete the rest
  const { data: dupes, error: fetchErr } = await supabaseAdmin.rpc('delete_sound_duplicates')

  if (fetchErr) {
    // RPC doesn't exist yet — fall back to manual approach
    console.warn('[cleanup] RPC not available, using manual approach')

    const { data: all, error: allErr } = await supabaseAdmin
      .from('sound_library')
      .select('id, file_path, created_at')
      .not('file_path', 'is', null)
      .order('created_at', { ascending: true })

    if (allErr) {
      console.error('[cleanup] fetch error:', allErr)
      return NextResponse.json({ error: allErr.message }, { status: 500 })
    }

    // Keep first occurrence per file_path, collect IDs to delete
    const seen = new Map<string, string>()
    const toDelete: string[] = []

    for (const row of all ?? []) {
      const fp = row.file_path as string
      if (seen.has(fp)) {
        toDelete.push(row.id as string)
      } else {
        seen.set(fp, row.id as string)
      }
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'Keine Duplikate gefunden.' })
    }

    // Delete in batches of 500
    let totalDeleted = 0
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = toDelete.slice(i, i + 500)
      const { error: delErr } = await supabaseAdmin
        .from('sound_library')
        .delete()
        .in('id', batch)
      if (delErr) {
        console.error('[cleanup] delete error:', delErr)
        return NextResponse.json({ error: delErr.message, deleted: totalDeleted }, { status: 500 })
      }
      totalDeleted += batch.length
    }

    return NextResponse.json({ deleted: totalDeleted })
  }

  return NextResponse.json({ deleted: dupes })
}

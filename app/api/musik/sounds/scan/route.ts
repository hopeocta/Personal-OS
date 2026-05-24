import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'
import path from 'path'
import fs from 'fs'

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.aif', '.aiff', '.flac', '.ogg', '.m4a', '.mp4'])
const VALID_CATEGORIES = ['drums', 'bass', 'synth', 'vocals', 'fx', 'loop', 'oneshot', 'sample']
const BPM_REGEX = /\b(6[0-9]|[7-9][0-9]|1[0-9]{2}|200)\b/
const KEY_REGEX = /\b([A-G][b#]?m?)\b/
const CLAUDE_BATCH_SIZE = 50
const IMPORT_LIMIT = 5000

function scanDirectory(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...scanDirectory(fullPath))
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (AUDIO_EXTENSIONS.has(ext)) {
          results.push(fullPath)
        }
      }
    }
  } catch (err) {
    console.error(`[scan] Cannot read ${dir}:`, err)
  }
  return results
}

function getLibraryPath(): { path: string } | { error: string; status: number } {
  const libraryPath = process.env.SAMPLE_LIBRARY_PATH
  if (!libraryPath) return { error: 'SAMPLE_LIBRARY_PATH not set. Add it to .env.local.', status: 400 }
  if (!fs.existsSync(libraryPath)) return { error: `Path does not exist: ${libraryPath}`, status: 400 }
  return { path: libraryPath }
}

async function fetchAllExistingPaths(): Promise<Set<string>> {
  const paths = new Set<string>()
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data } = await supabaseAdmin
      .from('sound_library')
      .select('file_path')
      .not('file_path', 'is', null)
      .range(from, from + pageSize - 1)
    if (!data || data.length === 0) break
    for (const r of data) paths.add(r.file_path as string)
    if (data.length < pageSize) break
    from += pageSize
  }
  return paths
}

// GET — scan only, return counts
export async function GET() {
  const result = getLibraryPath()
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const allFiles = scanDirectory(result.path)
  const existingPaths = await fetchAllExistingPaths()
  const newFiles = allFiles.filter((p) => !existingPaths.has(p))

  return NextResponse.json({
    library_path: result.path,
    total_found: allFiles.length,
    already_imported: allFiles.length - newFiles.length,
    new_files: newFiles.length,
    will_import: Math.min(newFiles.length, IMPORT_LIMIT),
    limit: IMPORT_LIMIT,
  })
}

// POST — scan + import new files via Claude Haiku
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const limit: number = typeof body.limit === 'number' ? body.limit : IMPORT_LIMIT

  const result = getLibraryPath()
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const allFiles = scanDirectory(result.path)
  const existingPaths = await fetchAllExistingPaths()
  const newFiles = allFiles.filter((p) => !existingPaths.has(p)).slice(0, limit)

  if (newFiles.length === 0) {
    return NextResponse.json({ imported: 0, remaining: 0 })
  }

  const anthropic = new Anthropic()
  let totalImported = 0

  for (let i = 0; i < newFiles.length; i += CLAUDE_BATCH_SIZE) {
    const batch = newFiles.slice(i, i + CLAUDE_BATCH_SIZE)
    const filenames = batch.map((p) => path.basename(p))

    let categorized: Array<{ category: string; tags: string[] }> = filenames.map(() => ({
      category: 'sample',
      tags: [],
    }))

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: `Given these sample filenames, suggest category and up to 3 tags for each.
Return ONLY a JSON array, no other text:
[{"name":"filename","category":"one of: drums,bass,synth,vocals,fx,loop,oneshot,sample","tags":["tag1","tag2"]}]`,
        messages: [{ role: 'user', content: filenames.join('\n') }],
      })

      const textBlock = msg.content.find((c) => c.type === 'text')
      if (textBlock && textBlock.type === 'text') {
        const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const claudeResult: Array<{ name?: string; category?: string; tags?: string[] }> = JSON.parse(cleaned)
        if (Array.isArray(claudeResult)) {
          categorized = filenames.map((_, idx) => {
            const fromClaude = claudeResult[idx] ?? {}
            return {
              category: VALID_CATEGORIES.includes(fromClaude.category ?? '')
                ? (fromClaude.category as string)
                : 'sample',
              tags: Array.isArray(fromClaude.tags) ? fromClaude.tags.slice(0, 3).map(String) : [],
            }
          })
        }
      }
    } catch (err) {
      console.error('[scan] Claude batch error:', err)
    }

    const rows = batch.map((filePath, idx) => {
      const name = path.basename(filePath)
      const cat = categorized[idx]
      const bpmMatch = name.match(BPM_REGEX)
      const keyMatch = name.match(KEY_REGEX)
      return {
        name,
        category: cat.category,
        subcategory: null as null,
        tags: cat.tags.length > 0 ? cat.tags : null,
        bpm: bpmMatch ? parseInt(bpmMatch[0]) : null,
        musical_key: keyMatch ? keyMatch[0] : null,
        file_path: filePath,
        notes: null as null,
        user_id: 'me',
      }
    })

    const { data, error } = await supabaseAdmin.from('sound_library').insert(rows).select('id')
    if (error) {
      console.error('[scan] INSERT error:', error)
    } else {
      totalImported += data?.length ?? 0
    }
  }

  const remaining = allFiles.filter((p) => !existingPaths.has(p)).length - totalImported

  return NextResponse.json({ imported: totalImported, remaining: Math.max(0, remaining) })
}

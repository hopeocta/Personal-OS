import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const VALID_CATEGORIES = ['drums', 'bass', 'synth', 'vocals', 'fx', 'loop', 'oneshot', 'sample']

const BPM_REGEX = /\b(6[0-9]|[7-9][0-9]|1[0-9]{2}|200)\b/
const KEY_REGEX = /\b([A-G][b#]?m?)\b/

type ParsedEntry = {
  name: string
  category: string
  tags: string[]
  bpm: number | null
  musical_key: string | null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { filenames } = body

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return NextResponse.json({ error: 'filenames array required' }, { status: 400 })
  }

  const names: string[] = filenames.map((f: string) => String(f).trim()).filter(Boolean)
  if (names.length === 0) {
    return NextResponse.json({ error: 'no valid filenames' }, { status: 400 })
  }

  let parsed: ParsedEntry[] = names.map((n) => ({
    name: n,
    category: 'sample',
    tags: [],
    bpm: null,
    musical_key: null,
  }))

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `Given these sample filenames, suggest category and up to 3 tags for each.
Return ONLY a JSON array, no other text:
[{"name": "filename", "category": "one of: drums,bass,synth,vocals,fx,loop,oneshot,sample", "tags": ["tag1","tag2"]}]`,
      messages: [{ role: 'user', content: names.join('\n') }],
    })

    const textBlock = msg.content.find((c) => c.type === 'text')
    if (textBlock && textBlock.type === 'text') {
      const cleaned = textBlock.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      const claudeResult: Array<{ name?: string; category?: string; tags?: string[] }> = JSON.parse(cleaned)

      if (Array.isArray(claudeResult)) {
        parsed = names.map((name, i) => {
          const fromClaude = claudeResult[i] ?? {}
          const category = VALID_CATEGORIES.includes(fromClaude.category ?? '')
            ? (fromClaude.category as string)
            : 'sample'
          const tags = Array.isArray(fromClaude.tags)
            ? fromClaude.tags.slice(0, 3).map(String)
            : []
          const bpmMatch = name.match(BPM_REGEX)
          const keyMatch = name.match(KEY_REGEX)
          return {
            name,
            category,
            tags,
            bpm: bpmMatch ? parseInt(bpmMatch[0]) : null,
            musical_key: keyMatch ? keyMatch[0] : null,
          }
        })
      }
    }
  } catch (err) {
    console.error('[musik/sounds/bulk] Claude error:', err)
  }

  const rows = parsed.map((p) => ({
    name: p.name,
    category: p.category,
    subcategory: null,
    tags: p.tags.length > 0 ? p.tags : null,
    bpm: p.bpm,
    musical_key: p.musical_key,
    file_path: null,
    notes: null,
    user_id: 'me',
  }))

  const { data, error } = await supabaseAdmin
    .from('sound_library')
    .insert(rows)
    .select()

  if (error) {
    console.error('[musik/sounds/bulk] INSERT error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ imported: data?.length ?? 0, entries: data })
}

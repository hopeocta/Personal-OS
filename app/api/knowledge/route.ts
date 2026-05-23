import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const VALID_CATEGORIES = [
  'Zahnmedizin', 'Triathlon', 'Krafttraining', 'Ernährung',
  'Musikproduktion', 'FL Studio', 'Sampling', 'Allgemein',
]

async function writeToObsidian(
  category: string,
  date: string,
  summary: string,
  rawText: string,
  tags: string[],
) {
  const obsidianUrl = process.env.OBSIDIAN_API_URL
  const obsidianKey = process.env.OBSIDIAN_API_KEY
  if (!obsidianUrl || !obsidianKey) return

  const slug = summary
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50)

  const filepath = `Recherche/${category}/${date}-${slug}.md`
  const encodedPath = filepath.split('/').map(encodeURIComponent).join('/')

  const content = `---
date: ${date}
category: ${category}
tags: [${tags.join(', ')}]
---
# ${summary}

${rawText}`

  try {
    const res = await fetch(`${obsidianUrl}/vault/${encodedPath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${obsidianKey}`,
        'Content-Type': 'text/markdown',
      },
      body: content,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error('[knowledge] Obsidian write failed:', res.status)
    }
  } catch (err) {
    console.error('[knowledge] Obsidian unreachable:', err)
  }
}

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
  const { raw_text, source, category: presetCategory } = body

  if (!raw_text?.trim()) {
    return NextResponse.json({ error: 'raw_text required' }, { status: 400 })
  }

  let category = presetCategory && VALID_CATEGORIES.includes(presetCategory)
    ? presetCategory
    : 'Allgemein'
  let summary: string = raw_text.slice(0, 120)
  let tags: string[] = []

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You are a knowledge categorization assistant.
Analyze the text and return ONLY valid JSON, no other text:
{
  "category": "one of [Zahnmedizin, Triathlon, Krafttraining, Ernährung, Musikproduktion, FL Studio, Sampling, Allgemein]",
  "summary": "one sentence summary in German, max 120 chars",
  "tags": ["tag1", "tag2", "tag3"]
}`,
      messages: [{ role: 'user', content: raw_text }],
    })

    const textBlock = msg.content.find((c) => c.type === 'text')
    if (textBlock && textBlock.type === 'text') {
      const cleaned = textBlock.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      const parsed = JSON.parse(cleaned)

      if (!presetCategory) {
        category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'Allgemein'
      }
      summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 120) : summary
      tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : []
    }
  } catch (err) {
    console.error('[knowledge] Claude categorization error:', err)
  }

  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .insert({
      raw_text,
      category,
      summary,
      tags,
      source: source ?? 'dashboard',
      user_id: 'me',
    })
    .select()
    .single()

  if (error) {
    console.error('[knowledge] INSERT error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)
  void writeToObsidian(category, today, summary, raw_text, tags)

  return NextResponse.json(data)
}

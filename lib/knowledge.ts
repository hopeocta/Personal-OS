import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'
import type { KnowledgeEntry } from '@/lib/types'
import { embedText, buildEmbedInput } from '@/lib/embeddings'
import { appendToDailyLog, berlinNow } from '@/lib/obsidian'
import { knowledgeEntryVaultPath } from '@/lib/obsidianPaths'
import { VALID_CATEGORIES, NOTE_CATEGORIES } from '@/lib/categories'

// Re-export für bestehende Importe (Client Components importieren stattdessen aus
// '@/lib/categories', um das Anthropic SDK nicht in den Browser-Bundle zu ziehen).
export { VALID_CATEGORIES, NOTE_CATEGORIES }

const anthropic = new Anthropic()

async function embedAndStore(id: string, summary: string, rawText: string): Promise<void> {
  try {
    const embedding = await embedText(buildEmbedInput(summary, rawText))
    const { error } = await supabaseAdmin
      .from('knowledge_entries')
      .update({ embedding })
      .eq('id', id)
    if (error) console.error('[knowledge] embedding update error:', error)
  } catch (err) {
    console.error('[knowledge] embedAndStore error:', err)
  }
}

async function writeToObsidian(
  category: string,
  date: string,
  summary: string,
  rawText: string,
  tags: string[],
): Promise<void> {
  const obsidianUrl = process.env.OBSIDIAN_API_URL
  const obsidianKey = process.env.OBSIDIAN_API_KEY
  if (!obsidianUrl || !obsidianKey) return

  const slug = summary
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50)

  const filepath = knowledgeEntryVaultPath(category, date, slug)
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

/** Schreibt ein Dokument (Gesundheit/Verwaltung/Training/…) in den durchsuchbaren
 *  RAG-Index. Feste Kategorie, KEIN Claude-Call (Kategorie + Zusammenfassung kommen
 *  fertig vom Aufrufer). Damit wird JEDES Dokument über search_knowledge auffindbar,
 *  egal über welchen Kanal es kam. Embedding wird synchron gesetzt (await — Vercel
 *  friert die Serverless-Function nach der Response ein, void liefe nicht zu Ende). */
export async function saveDocumentKnowledge(params: {
  raw_text: string
  category: string
  summary: string
  tags?: string[]
  source: string
  contentHash?: string
}): Promise<string | null> {
  const { raw_text, category, summary, tags = [], source, contentHash } = params
  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .insert({ raw_text, category, summary, tags, source, user_id: 'me', content_hash: contentHash ?? null })
    .select('id')
    .single()
  if (error) {
    console.error('[knowledge] saveDocumentKnowledge insert error:', error)
    return null
  }
  await embedAndStore(data.id, summary, raw_text)
  return data.id as string
}

/** Sucht eine bereits archivierte Dokumentzeile mit demselben Inhalts-Hash (Duplikat-Schutz).
 *  Liefert die vorhandene Zusammenfassung, falls vorhanden — sonst null. */
export async function findDocumentByHash(
  contentHash: string,
): Promise<{ id: string; summary: string | null; category: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('id, summary, category')
    .eq('content_hash', contentHash)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[knowledge] findDocumentByHash error:', error)
    return null
  }
  return data ?? null
}

/** Günstige Zusammenfassung ohne KI: erste sinnvolle Zeile, max 120 Zeichen.
 *  Entfernt einen führenden "[Quelle: …]"-Header (vom PDF-Importer). */
function cheapSummary(rawText: string): string {
  const withoutHeader = rawText.replace(/^\[Quelle:[^\]]*\]\s*/i, '').trim()
  const firstLine = withoutHeader.split(/\n+/).find((l) => l.trim().length > 0) ?? withoutHeader
  return firstLine.trim().slice(0, 120)
}

export async function saveKnowledgeEntry(params: {
  raw_text: string
  source?: string
  category?: string
}): Promise<KnowledgeEntry> {
  const { raw_text, source, category: presetCategory } = params

  const hasPreset =
    !!presetCategory && (VALID_CATEGORIES as readonly string[]).includes(presetCategory)
  let category = hasPreset ? (presetCategory as string) : 'Allgemein'
  let summary: string = cheapSummary(raw_text)
  let tags: string[] = []

  // KOSTEN-BREMSE: Claude-Kategorisierung NUR wenn keine Kategorie vorgegeben ist.
  // Bei Bulk-Importen (Bücher → preset 'Zahnmedizin') oder Telegram-Lernen ist die
  // Kategorie bereits bekannt — ein Haiku-Call pro Chunk über das volle Kapitel wäre
  // teuer und überflüssig. Der Text wird ohnehin per Embedding (OpenAI) durchsuchbar.
  // Historie: 24.05.2026 kostete genau diese Schleife mehrere Dollar (1089 Kapitel).
  if (!hasPreset) {
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
        // Nur ein Auszug reicht zum Kategorisieren — spart Tokens bei langen Texten.
        messages: [{ role: 'user', content: raw_text.slice(0, 4000) }],
      })

      const textBlock = msg.content.find((c) => c.type === 'text')
      if (textBlock && textBlock.type === 'text') {
        const cleaned = textBlock.text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        const parsed = JSON.parse(cleaned)

        category = (VALID_CATEGORIES as readonly string[]).includes(parsed.category)
          ? parsed.category
          : 'Allgemein'
        summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 120) : summary
        tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : []
      }
    } catch (err) {
      console.error('[knowledge] Claude categorization error:', err)
    }
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
    throw new Error(error.message)
  }

  const today = new Date().toISOString().slice(0, 10)
  void writeToObsidian(category, today, summary, raw_text, tags)
  await embedAndStore(data.id, summary, raw_text)

  return data as KnowledgeEntry
}

// ── Note entries (Telegram diary/reminders) ───────────────────────────────────
// Notizen landen im Tages-Logbuch (appendToDailyLog), nicht mehr in separaten
// Tagebuch/-Dateien (Phase 7). Die alte writeNoteToObsidian wurde entfernt.

export async function saveNoteEntry(params: {
  raw_text: string
  date: string
}): Promise<KnowledgeEntry> {
  const { raw_text, date } = params

  let category: string = 'Projekte'
  let summary: string = raw_text.slice(0, 120)

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      system: `Du kategorisierst persönliche Sprachnotizen. Antworte NUR mit validem JSON:
{"category": "eine von [Training-relevant, Soziales, Arbeit-Uni, Recherche, Projekte]", "summary": "ein Satz auf Deutsch, max 100 Zeichen"}`,
      messages: [{ role: 'user', content: raw_text }],
    })

    const textBlock = msg.content.find((c) => c.type === 'text')
    if (textBlock && textBlock.type === 'text') {
      const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if ((NOTE_CATEGORIES as readonly string[]).includes(parsed.category)) {
        category = parsed.category
      }
      if (typeof parsed.summary === 'string') summary = parsed.summary.slice(0, 120)
    }
  } catch (err) {
    console.error('[note] Claude categorization error:', err)
  }

  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .insert({ raw_text, category, summary, tags: ['notiz'], source: 'telegram_note', user_id: 'me' })
    .select()
    .single()

  if (error) {
    console.error('[note] INSERT error:', error)
    throw new Error(error.message)
  }

  const { timeBerlin } = berlinNow()
  void appendToDailyLog({ kind: 'note', timeBerlin, dateKey: date, category, content: `${category}: ${summary}` })
  await embedAndStore(data.id, summary, raw_text)

  return data as KnowledgeEntry
}

// ── Plan entries (Telegram "Pläne"-Button) ────────────────────────────────────
// Eigener Obsidian-Ordner, feste Kategorie 'Projekte', KEIN Claude-Call.

async function writePlanToObsidian(
  date: string,
  summary: string,
  rawText: string,
): Promise<void> {
  const obsidianUrl = process.env.OBSIDIAN_API_URL
  const obsidianKey = process.env.OBSIDIAN_API_KEY
  if (!obsidianUrl || !obsidianKey) return

  const slug = summary
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)

  const filepath = `Logbuch/Pläne und Ideen/${date}-${slug}.md`
  const encodedPath = filepath.split('/').map(encodeURIComponent).join('/')
  const content = `---\ndate: ${date}\ncategory: Projekte\nsource: telegram\n---\n\n# ${summary}\n\n${rawText}`

  try {
    const res = await fetch(`${obsidianUrl}/vault/${encodedPath}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${obsidianKey}`, 'Content-Type': 'text/markdown' },
      body: content,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) console.error('[plan] Obsidian write failed:', res.status)
  } catch (err) {
    console.error('[plan] Obsidian unreachable:', err)
  }
}

export async function savePlanEntry(params: {
  raw_text: string
  date: string
}): Promise<KnowledgeEntry> {
  const { raw_text, date } = params
  const summary = cheapSummary(raw_text)

  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .insert({ raw_text, category: 'Projekte', summary, tags: ['plan'], source: 'telegram', user_id: 'me' })
    .select()
    .single()

  if (error) {
    console.error('[plan] INSERT error:', error)
    throw new Error(error.message)
  }

  void writePlanToObsidian(date, summary, raw_text)
  const { timeBerlin: planTime } = berlinNow()
  void appendToDailyLog({ kind: 'note', timeBerlin: planTime, dateKey: date, category: 'Projekte', content: `Pläne: ${summary}` })
  await embedAndStore(data.id, summary, raw_text)

  return data as KnowledgeEntry
}

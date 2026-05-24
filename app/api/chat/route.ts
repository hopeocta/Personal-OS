import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { SKILLS } from '@/lib/config/skills'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { messages, skillKey, lernfach } = body as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    skillKey: string | null
    lernfach: string | null
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Build system blocks with prompt caching
  const systemBlocks: Anthropic.TextBlockParam[] = []

  // Block 1: Base instructions (always cached)
  systemBlocks.push({
    type: 'text',
    text: 'Du bist ein persönlicher Assistent. Antworte präzise und auf Deutsch. Sei direkt und konkret. Keine Füllwörter, keine unnötigen Disclaimers.',
    cache_control: { type: 'ephemeral' },
  })

  // Block 2: Skill prompt (if selected)
  if (skillKey && SKILLS[skillKey]) {
    systemBlocks.push({
      type: 'text',
      text: SKILLS[skillKey].prompt,
      cache_control: { type: 'ephemeral' },
    })
  }

  // Block 3: Lernfach documents (if selected — cached for entire session)
  if (lernfach) {
    const { data, error } = await supabaseAdmin
      .from('knowledge_entries')
      .select('summary, raw_text')
      .eq('category', lernfach)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) console.error('[chat] knowledge fetch error:', error)

    if (data && data.length > 0) {
      const docs = data
        .map((e) => `### ${e.summary ?? 'Dokument'}\n\n${e.raw_text}`)
        .join('\n\n---\n\n')
      systemBlocks.push({
        type: 'text',
        text: `Du hast Zugriff auf folgende Dokumente zum Thema "${lernfach}":\n\n${docs}`,
        cache_control: { type: 'ephemeral' },
      })
    }
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemBlocks,
          messages,
        })

        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        // Get final message for usage stats
        const finalMsg = await claudeStream.finalMessage()
        const u = finalMsg.usage
        const raw = u as unknown as Record<string, number | undefined>
        const usageData = {
          cacheRead: raw.cache_read_input_tokens ?? 0,
          cacheWrite: raw.cache_creation_input_tokens ?? 0,
          input: u.input_tokens,
          output: u.output_tokens,
        }

        // Append usage as null-byte separated JSON (never appears in text)
        controller.enqueue(encoder.encode('\x00' + JSON.stringify(usageData)))
        controller.close()
      } catch (err) {
        console.error('[chat] stream error:', err)
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

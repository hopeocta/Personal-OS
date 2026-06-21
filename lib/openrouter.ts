import 'server-only'

const BASE = 'https://openrouter.ai/api/v1'
export const OWL_MODEL = 'openrouter/owl-alpha'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function owlChat(
  messages: ChatMessage[],
  opts?: { maxTokens?: number }
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY nicht gesetzt')

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://personal-os-ten-iota.vercel.app',
      'X-Title': 'Personal OS',
    },
    body: JSON.stringify({
      model: OWL_MODEL,
      messages,
      max_tokens: opts?.maxTokens ?? 1024,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content ?? ''
}

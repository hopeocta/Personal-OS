export const EMBED_MODEL = 'text-embedding-3-small'
export const EMBED_DIM = 1536

/** Single embedding via OpenAI text-embedding-3-small. Returns float array. */
export async function embedText(input: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`[embeddings] OpenAI error ${res.status}: ${msg}`)
  }
  const json = await res.json()
  return json.data[0].embedding as number[]
}

/** Batch embedding — up to 100 inputs per call (OpenAI limit). */
export async function embedBatch(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return []
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`[embeddings] OpenAI batch error ${res.status}: ${msg}`)
  }
  const json = await res.json()
  // OpenAI returns results in order matching input index
  return (json.data as { index: number; embedding: number[] }[])
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}

/** Input string for embedding: summary + raw_text concatenated. */
export function buildEmbedInput(summary: string, rawText: string): string {
  return `${summary}\n\n${rawText}`
}

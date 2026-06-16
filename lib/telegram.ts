import 'server-only'
import { supabaseAdmin } from './supabaseAdmin'

// Eigenständiger Telegram-Helfer für die Mobile-App (Hermes „An Telegram senden").
// Bewusst getrennt vom Webhook-Handler, damit der laufende Bot unangetastet bleibt.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const USER_ID = process.env.TELEGRAM_USER_ID

async function telegramApi(method: string, payload: Record<string, unknown>): Promise<void> {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN fehlt')
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = (await res.json()) as { ok: boolean; description?: string }
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`)
}

export type DocHit = { id: string; summary: string | null; category: string | null }

// Sucht Dokumente (mit hinterlegtem Tresor-Pfad) per Wort-Treffer in summary/raw_text.
export async function searchDocuments(query: string): Promise<DocHit[]> {
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, ''))
    .filter((w) => w.length > 2)
    .slice(0, 5)
  const terms = words.length > 0 ? words : [query.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '')]
  if (!terms[0]) return []

  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('id, summary, category, storage_path')
    .not('storage_path', 'is', null)
    .or(terms.map((w) => `summary.ilike.*${w}*,raw_text.ilike.*${w}*`).join(','))
    .limit(6)

  if (error) {
    console.error('[telegram] doc search error:', error)
    throw new Error(error.message)
  }
  return (data ?? []).map((d) => ({ id: d.id, summary: d.summary, category: d.category }))
}

// Schickt das Originaldokument per signierter URL an den festen Telegram-User.
export async function sendDocumentToTelegram(knowledgeId: string): Promise<{ summary: string }> {
  if (!USER_ID) throw new Error('TELEGRAM_USER_ID fehlt')

  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('summary, storage_path')
    .eq('id', knowledgeId)
    .maybeSingle()
  if (error || !data?.storage_path) throw new Error('Original nicht verfügbar (kein Tresor-Pfad)')

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(data.storage_path, 120)
  if (signErr || !signed?.signedUrl) throw new Error('Konnte das Dokument nicht laden')

  const summary = data.summary ?? 'Dokument'
  await telegramApi('sendDocument', { chat_id: Number(USER_ID), document: signed.signedUrl, caption: summary })
  return { summary }
}

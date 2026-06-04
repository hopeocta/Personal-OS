import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { saveKnowledgeEntry, saveNoteEntry, savePlanEntry, type PlanSubfolder } from '@/lib/knowledge'
import { createCalendarEvent } from '@/lib/googleCalendar'
import { processGesundheitDoc, processVerwaltungDoc, type IncomingDoc, type DocKind } from '@/lib/documents'
import { answerQuestion } from '@/lib/answer'
import { appendToDailyLog, berlinNow } from '@/lib/obsidian'

export const maxDuration = 30

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_USER_ID ?? '0', 10)

const anthropic = new Anthropic()

// ── MIME helpers ───────────────────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES: Record<string, DocKind> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  // Office / text documents — sent as-is to Claude for text extraction
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'pdf', // DOCX → treat as pdf-like
  'application/msword': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'pdf', // XLSX
  'application/vnd.ms-excel': 'pdf',
  'text/plain': 'pdf',
  'text/csv': 'pdf',
}

function getSupportedKind(mime: string): DocKind | null {
  return SUPPORTED_MIME_TYPES[mime] ?? (mime.startsWith('image/') ? 'image' : null)
}

function mimeLabel(mime: string): string {
  const labels: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word-Dokument',
    'application/msword': 'Word-Dokument',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel-Tabelle',
    'application/vnd.ms-excel': 'Excel-Tabelle',
    'text/plain': 'Textdatei',
    'text/csv': 'CSV-Datei',
  }
  if (mime.startsWith('image/')) return 'Bild'
  return labels[mime] ?? 'Dokument'
}

// ── Calendar intent types ─────────────────────────────────────────────────────

interface ParsedCalendarIntent {
  action: 'CREATE' | 'UNKNOWN'
  title: string
  start_datetime: string
  end_datetime: string | null
  reminder_offset: number | null
  confidence: 'high' | 'medium' | 'low'
  raw_date_phrase: string
}

// ── Telegram types ────────────────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

interface TelegramMessage {
  message_id: number
  from?: { id: number; first_name: string }
  chat: { id: number }
  text?: string
  caption?: string
  voice?: { file_id: string; duration: number; mime_type?: string }
  photo?: { file_id: string; file_unique_id: string; width: number; height: number }[]
  document?: { file_id: string; file_name?: string; mime_type?: string }
}

interface TelegramCallbackQuery {
  id: string
  from: { id: number }
  message?: { chat: { id: number }; message_id: number }
  data?: string
}

// ── In-memory stores ──────────────────────────────────────────────────────────

const pendingMessages = new Map<string, { text: string; expires: number }>()
const shoppingLists = new Map<string, { ids: string[]; expires: number }>()

function storePending(text: string): string {
  const id = Math.random().toString(36).slice(2, 10)
  pendingMessages.set(id, { text, expires: Date.now() + 10 * 60 * 1000 })
  for (const [k, v] of pendingMessages) {
    if (v.expires < Date.now()) pendingMessages.delete(k)
  }
  return id
}

function popPending(id: string): string | null {
  const entry = pendingMessages.get(id)
  if (!entry || entry.expires < Date.now()) {
    pendingMessages.delete(id)
    return null
  }
  pendingMessages.delete(id)
  return entry.text
}

// ── Document + Plan capture state (durable in Supabase) ───────────────────────

interface PendingFile {
  fileId: string
  kind: DocKind | 'plan'
  mimeType: string
  caption: string
  dateIso: string
}

async function savePendingDoc(
  chatId: number,
  file: { fileId: string; kind: DocKind | 'plan'; mimeType: string; caption: string },
  dateIso: string | null,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('telegram_pending_docs')
    .insert({
      chat_id: chatId,
      file_id: file.fileId,
      kind: file.kind,
      mime_type: file.mimeType,
      caption: file.caption,
      date_iso: dateIso,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[telegram] savePendingDoc error:', error)
    return null
  }
  return data.id as string
}

async function getAwaitingDateDoc(
  chatId: number,
): Promise<{ id: string; fileId: string; kind: DocKind; mimeType: string; caption: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('telegram_pending_docs')
    .select('id, file_id, kind, mime_type, caption')
    .eq('chat_id', chatId)
    .is('date_iso', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[telegram] getAwaitingDateDoc error:', error)
    return null
  }
  if (!data) return null
  return { id: data.id, fileId: data.file_id, kind: data.kind as DocKind, mimeType: data.mime_type, caption: data.caption }
}

async function setPendingDocDate(id: string, dateIso: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('telegram_pending_docs')
    .update({ date_iso: dateIso })
    .eq('id', id)
  if (error) console.error('[telegram] setPendingDocDate error:', error)
}

async function popPendingDoc(id: string): Promise<PendingFile | null> {
  const { data, error } = await supabaseAdmin
    .from('telegram_pending_docs')
    .select('file_id, kind, mime_type, caption, date_iso, expires_at')
    .eq('id', id)
    .maybeSingle()
  if (error || !data || !data.date_iso) {
    if (error) console.error('[telegram] popPendingDoc error:', error)
    return null
  }
  await supabaseAdmin.from('telegram_pending_docs').delete().eq('id', id)
  if (new Date(data.expires_at).getTime() < Date.now()) return null
  return {
    fileId: data.file_id,
    kind: data.kind as DocKind | 'plan',
    mimeType: data.mime_type,
    caption: data.caption,
    dateIso: data.date_iso,
  }
}

async function savePendingPlan(chatId: number, text: string, dateIso: string): Promise<string | null> {
  return savePendingDoc(chatId, { fileId: 'plan', kind: 'plan', mimeType: 'text/plain', caption: text }, dateIso)
}

function parseDateFromText(text: string): string | null {
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  let year = parseInt(m[3], 10)
  if (year < 100) year += 2000
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function captionWithoutDate(caption: string): string {
  return caption.replace(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/, '').replace(/\s+/g, ' ').trim()
}

function makeDocKeyboard(docId: string) {
  return {
    inline_keyboard: [
      [
        { text: '🩺 Gesundheit', callback_data: `doc:GES:${docId}` },
        { text: '📋 Verwaltung', callback_data: `doc:VW:${docId}` },
      ],
    ],
  }
}

async function downloadTelegramFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string; path: string }> {
  const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
  const fileJson = await fileRes.json()
  if (!fileJson.ok) throw new Error(`getFile failed: ${JSON.stringify(fileJson)}`)
  const filePath: string = fileJson.result.file_path
  const dataRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)
  if (!dataRes.ok) throw new Error(`download failed: ${dataRes.status}`)
  const buffer = Buffer.from(await dataRes.arrayBuffer())
  const ext = (filePath.split('.').pop() ?? '').toLowerCase()
  const mimeType =
    ext === 'pdf' ? 'application/pdf'
    : ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : ext === 'txt' ? 'text/plain'
    : ext === 'csv' ? 'text/csv'
    : 'image/jpeg'
  return { buffer, mimeType, path: filePath }
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

function getBerlinIso(date: Date): string {
  const localStr = date.toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).replace(' ', 'T')
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Berlin',
    timeZoneName: 'shortOffset',
  }).formatToParts(date)
  const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+2'
  const match = tzPart.match(/GMT([+-])(\d+)/)
  const sign = match?.[1] ?? '+'
  const hours = (match?.[2] ?? '2').padStart(2, '0')
  return `${localStr}${sign}${hours}:00`
}

function buildCalendarSystemPrompt(timestampIso: string, weekday: string): string {
  return `Du bist ein Kalender-Intent-Parser in einem deutschen Sprachassistenten.
Deine einzige Aufgabe ist es, strukturierte Kalender-Daten aus natürlichsprachlicher Eingabe zu extrahieren und strikt JSON zurückzugeben.

## Aktueller Kontext
- Aktuelle lokale Zeit (Berlin, Europe/Berlin): ${timestampIso}
- Aktueller Wochentag: ${weekday}

## Ausgabe-Schema — NUR dieses JSON zurückgeben
{
  "action": "CREATE" | "UNKNOWN",
  "title": string,
  "start_datetime": string,
  "end_datetime": string | null,
  "reminder_offset": number | null,
  "confidence": "high" | "medium" | "low",
  "raw_date_phrase": string
}

## Regeln
- CREATE: Termin hinzufügen/erstellen/blocken
- title: max 60 Zeichen, Füllwörter entfernen
- start_datetime: ISO 8601 Berlin-Offset, morgens=08:00, mittags=12:00, abends=19:00, default=09:00
- end_datetime / reminder_offset: nur wenn explizit genannt, sonst null`
}

function formatDateTimeDE(isoString: string): { date: string; time: string } {
  const d = new Date(isoString)
  return {
    date: d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Europe/Berlin' }),
    time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }),
  }
}

async function parseCalendarIntent(text: string): Promise<ParsedCalendarIntent> {
  const now = new Date()
  const timestampIso = getBerlinIso(now)
  const weekday = now.toLocaleDateString('de-DE', { weekday: 'long', timeZone: 'Europe/Berlin' })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: buildCalendarSystemPrompt(timestampIso, weekday),
    messages: [{ role: 'user', content: text }],
  })
  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as ParsedCalendarIntent
}

function buildCalendarFeedback(parsed: ParsedCalendarIntent): string {
  const start = formatDateTimeDE(parsed.start_datetime)
  const confidenceNote = parsed.confidence === 'low' ? '\n⚠️ Ich bin mir nicht ganz sicher — bitte kurz prüfen.' : ''
  let msg = `✅ *${parsed.title}*\n📅 ${start.date} um ${start.time} Uhr`
  if (parsed.end_datetime) {
    const end = formatDateTimeDE(parsed.end_datetime)
    msg += ` bis ${end.time} Uhr`
  }
  if (parsed.reminder_offset !== null) {
    const label = parsed.reminder_offset >= 60 ? `${parsed.reminder_offset / 60}h` : `${parsed.reminder_offset}min`
    msg += `\n🔔 Erinnerung ${label} vorher`
  }
  return msg + confidenceNote
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function serverDateKey(): string {
  const tz = process.env.USER_TIMEZONE ?? 'Europe/Berlin'
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

// ── Shopping list helpers ─────────────────────────────────────────────────────

async function getShoppingItems(): Promise<{ id: string; raw_text: string }[]> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('id, raw_text')
    .eq('source', 'einkauf')
    .eq('user_id', 'me')
    .order('created_at', { ascending: true })
  if (error) console.error('[shop] fetch error:', error)
  return (data ?? []) as { id: string; raw_text: string }[]
}

async function updateObsidianShoppingList(items: { raw_text: string }[]): Promise<void> {
  const obsidianUrl = process.env.OBSIDIAN_API_URL
  const obsidianKey = process.env.OBSIDIAN_API_KEY
  if (!obsidianUrl || !obsidianKey) return
  const date = serverDateKey()
  const bullets = items.length > 0 ? items.map((i) => `- [ ] ${i.raw_text}`).join('\n') : '_Liste ist leer_'
  const content = `---\nupdated: ${date}\n---\n\n# Aktuelle Einkaufsliste\n\n${bullets}\n`
  const encodedPath = `Einkauf/${encodeURIComponent('Aktuelle-Liste.md')}`
  try {
    const res = await fetch(`${obsidianUrl}/vault/${encodedPath}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${obsidianKey}`, 'Content-Type': 'text/markdown' },
      body: content,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) console.error('[shop] Obsidian write failed:', res.status)
  } catch (err) {
    console.error('[shop] Obsidian unreachable:', err)
  }
}

function buildShoppingMessage(items: { id: string; raw_text: string }[], listId: string) {
  shoppingLists.set(listId, { ids: items.map((i) => i.id), expires: Date.now() + 30 * 60 * 1000 })
  for (const [k, v] of shoppingLists) {
    if (v.expires < Date.now()) shoppingLists.delete(k)
  }
  if (items.length === 0) return { text: '🛒 Einkaufsliste ist leer.', keyboard: null }
  const text = `🛒 *Einkaufsliste* (${items.length} Artikel)\n\n${items.map((i, n) => `${n + 1}. ${i.raw_text}`).join('\n')}`
  const keyboard = { inline_keyboard: items.map((item, idx) => [{ text: `✅ ${item.raw_text}`, callback_data: `s:${listId}:${idx}` }]) }
  return { text, keyboard }
}

// ── Telegram API ──────────────────────────────────────────────────────────────

async function telegramPost(method: string, body: object): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error(`[telegram] ${method} failed:`, await res.text())
}

async function sendMessage(chatId: number, text: string, extra?: object): Promise<void> {
  await telegramPost('sendMessage', { chat_id: chatId, text, ...extra })
}

function makeKeyboard(pendingId: string) {
  return {
    inline_keyboard: [
      [
        { text: '🏃 Training', callback_data: `t:TR:${pendingId}` },
        { text: '🎵 Musik', callback_data: `t:MU:${pendingId}` },
        { text: '📚 Lernen', callback_data: `t:LE:${pendingId}` },
      ],
      [
        { text: '🗓️ Pläne', callback_data: `t:PL:${pendingId}` },
        { text: '📝 Notiz', callback_data: `t:NO:${pendingId}` },
      ],
      [
        { text: '🛒 Einkauf', callback_data: `t:EK:${pendingId}` },
        { text: '📅 Kalender', callback_data: `t:KA:${pendingId}` },
      ],
      [
        { text: '❓ Frage beantworten', callback_data: `t:FR:${pendingId}` },
      ],
    ],
  }
}

function makePlanSubKeyboard(planRowId: string) {
  return {
    inline_keyboard: [
      [
        { text: '🌍 Reisen', callback_data: `pl:reisen:${planRowId}` },
        { text: '⚙️ Projekt', callback_data: `pl:projekte:${planRowId}` },
      ],
    ],
  }
}

async function sendDocument(chatId: number, document: string, caption?: string): Promise<void> {
  await telegramPost('sendDocument', { chat_id: chatId, document, ...(caption ? { caption } : {}) })
}

async function handleFetchCommand(chatId: number, query: string): Promise<void> {
  if (!query) {
    await sendMessage(chatId, 'Was soll ich holen? z.B. *\\/hol blutbild* oder *\\/hol leistungsdiagnostik*', { parse_mode: 'Markdown' })
    return
  }
  const words = query.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '')).filter((w) => w.length > 2).slice(0, 5)
  const terms = words.length > 0 ? words : [query.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '')]
  const orFilter = terms.map((w) => `summary.ilike.%${w}%,raw_text.ilike.%${w}%`).join(',')
  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('id, summary, category, storage_path')
    .not('storage_path', 'is', null)
    .or(orFilter)
    .limit(8)
  if (error) {
    console.error('[telegram] fetch search error:', error)
    await sendMessage(chatId, '❌ Suche fehlgeschlagen.')
    return
  }
  const hits = (data ?? []) as { id: string; summary: string | null; category: string | null; storage_path: string }[]
  if (hits.length === 0) {
    await sendMessage(chatId, `🔍 Nichts gefunden zu "${query}".`)
    return
  }
  if (hits.length === 1) {
    await sendDocumentById(chatId, hits[0].id)
    return
  }
  await sendMessage(chatId, `🔍 ${hits.length} Treffer — welches?`, {
    reply_markup: {
      inline_keyboard: hits.map((h) => [{ text: `${h.category === 'Gesundheit' ? '🩺' : '📋'} ${(h.summary ?? 'Dokument').slice(0, 50)}`, callback_data: `hol:${h.id}` }]),
    },
  })
}

async function sendDocumentById(chatId: number, knowledgeId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('summary, storage_path')
    .eq('id', knowledgeId)
    .maybeSingle()
  if (error || !data?.storage_path) {
    await sendMessage(chatId, '❌ Original nicht verfügbar (kein Tresor-Pfad).')
    return
  }
  const { data: signed, error: signErr } = await supabaseAdmin.storage.from('documents').createSignedUrl(data.storage_path, 120)
  if (signErr || !signed?.signedUrl) {
    console.error('[telegram] signed url error:', signErr)
    await sendMessage(chatId, '❌ Konnte das Dokument nicht laden.')
    return
  }
  await sendMessage(chatId, `📤 Schicke: *${data.summary ?? 'Dokument'}*`, { parse_mode: 'Markdown' })
  await sendDocument(chatId, signed.signedUrl, data.summary ?? undefined)
}

async function transcribeVoice(fileId: string): Promise<string> {
  const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
  const fileJson = await fileRes.json()
  if (!fileJson.ok) throw new Error(`getFile failed: ${JSON.stringify(fileJson)}`)
  const filePath: string = fileJson.result.file_path
  const audioRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)
  if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`)
  const audioBuffer = await audioRes.arrayBuffer()
  const formData = new FormData()
  const ext = filePath.split('.').pop() ?? 'ogg'
  formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), `audio.${ext}`)
  formData.append('model', 'whisper-1')
  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: formData,
  })
  if (!whisperRes.ok) throw new Error(`Whisper error: ${whisperRes.status} ${await whisperRes.text()}`)
  const whisperJson = await whisperRes.json()
  return whisperJson.text as string
}

// ── Type routing ──────────────────────────────────────────────────────────────

type TypeCode = 'TR' | 'MU' | 'LE' | 'PL' | 'NO' | 'EK' | 'KA' | 'FR'

async function routeByType(typeCode: TypeCode, text: string, chatId: number): Promise<void> {
  const today = serverDateKey()
  const { timeBerlin } = berlinNow()

  switch (typeCode) {
    case 'TR': {
      const { error } = await supabaseAdmin.from('strength_sessions').insert({ date: today, intensity: 2, notes: text, user_id: 'me' })
      if (error) console.error('[telegram] strength insert:', error)
      void appendToDailyLog({ kind: 'note', timeBerlin, dateKey: today, content: `Training: ${text.slice(0, 80)}` })
      await sendMessage(chatId, '✓ Training geloggt — öffne Dashboard für Intensität')
      break
    }
    case 'MU': {
      const title = text.slice(0, 50)
      const { error } = await supabaseAdmin.from('music_projects').insert({ title, status: 'idea', notes: text, user_id: 'me' })
      if (error) console.error('[telegram] music insert:', error)
      void appendToDailyLog({ kind: 'note', timeBerlin, dateKey: today, content: `Musik: ${text.slice(0, 80)}` })
      await sendMessage(chatId, '✓ Musikidee gespeichert')
      break
    }
    case 'LE': {
      await saveKnowledgeEntry({ raw_text: text, source: 'telegram', category: 'Zahnmedizin' })
      void appendToDailyLog({ kind: 'note', timeBerlin, dateKey: today, content: `Lernen: ${text.slice(0, 80)}` })
      await sendMessage(chatId, '✓ Lernnotiz gespeichert → Zahnmedizin')
      break
    }
    case 'PL': {
      const planRowId = await savePendingPlan(chatId, text, today)
      if (!planRowId) {
        await sendMessage(chatId, '❌ Konnte den Plan nicht zwischenspeichern. Bitte erneut senden.')
        break
      }
      await sendMessage(chatId, `📁 Wo soll der Plan landen?\n\n"${text.slice(0, 80)}"`, {
        reply_markup: makePlanSubKeyboard(planRowId),
      })
      break
    }
    case 'FR': {
      await sendMessage(chatId, '🤔 Ich schau nach...')
      try {
        const ans = await answerQuestion(text)
        await sendMessage(chatId, ans.text, { parse_mode: 'Markdown' })
      } catch (err) {
        console.error('[telegram] RAG error:', err)
        await sendMessage(chatId, '❌ Konnte die Frage gerade nicht beantworten.')
      }
      break
    }
    case 'NO': {
      const entry = await saveNoteEntry({ raw_text: text, date: today })
      await sendMessage(chatId, `✓ Notiz gespeichert → ${entry.category}`)
      break
    }
    case 'EK': {
      const { error } = await supabaseAdmin.from('knowledge_entries').insert({ raw_text: text, category: 'Einkauf', summary: text.slice(0, 80), tags: ['einkauf'], source: 'einkauf', user_id: 'me' })
      if (error) console.error('[telegram] einkauf insert:', error)
      const allItems = await getShoppingItems()
      void updateObsidianShoppingList(allItems)
      await sendMessage(chatId, `🛒 "${text}" zur Einkaufsliste hinzugefügt (${allItems.length} Artikel gesamt)`)
      break
    }
    case 'KA': {
      await sendMessage(chatId, '📅 Analysiere Termin...')
      try {
        const parsed = await parseCalendarIntent(text)
        if (parsed.action === 'CREATE') {
          await createCalendarEvent({ title: parsed.title, startIso: parsed.start_datetime, endIso: parsed.end_datetime, reminderMinutes: parsed.reminder_offset })
          await sendMessage(chatId, buildCalendarFeedback(parsed), { parse_mode: 'Markdown' })
        } else {
          await sendMessage(chatId, '❌ Konnte keinen Termin erkennen.')
        }
      } catch (err) {
        console.error('[telegram] calendar error:', err)
        await sendMessage(chatId, `❌ Kalender-Fehler: ${String(err)}`)
      }
      break
    }
  }
}

// ── Document routing ──────────────────────────────────────────────────────────

async function processDocChoice(target: 'GES' | 'VW', file: PendingFile, chatId: number): Promise<void> {
  await sendMessage(chatId, target === 'GES' ? '🔍 Claude liest den Befund...' : '🗂 Lege ab...')
  let downloaded: { buffer: Buffer; mimeType: string }
  try {
    downloaded = await downloadTelegramFile(file.fileId)
  } catch (err) {
    console.error('[telegram] doc download error:', err)
    await sendMessage(chatId, `❌ Download fehlgeschlagen: ${String(err)}`)
    return
  }
  const doc: IncomingDoc = { buffer: downloaded.buffer, mimeType: downloaded.mimeType, kind: file.kind as DocKind, dateIso: file.dateIso, caption: file.caption }
  try {
    const result = target === 'GES' ? await processGesundheitDoc(doc) : await processVerwaltungDoc(doc)
    await sendMessage(chatId, result.message, { parse_mode: 'Markdown' })
    const { dateKey, timeBerlin } = berlinNow()
    const folder = target === 'GES' ? 'Gesundheit' : 'Verwaltung'
    void appendToDailyLog({ kind: 'document', timeBerlin, dateKey, content: `Dokument hochgeladen → ${folder}` })
  } catch (err) {
    console.error('[telegram] doc processing error:', err)
    await sendMessage(chatId, `❌ Verarbeitung fehlgeschlagen: ${String(err)}`)
  }
}

async function handleIncomingFile(
  params: { fileId: string; kind: DocKind; mimeType: string; rawCaption: string },
  chatId: number,
): Promise<void> {
  const { fileId, kind, mimeType, rawCaption } = params
  const dateIso = parseDateFromText(rawCaption)
  const caption = captionWithoutDate(rawCaption)
  if (!dateIso) {
    await savePendingDoc(chatId, { fileId, kind, mimeType, caption }, null)
    await sendMessage(chatId, '📅 Von wann ist das Dokument? Schick mir das Datum (z.B. *15.05.2026*).', { parse_mode: 'Markdown' })
    return
  }
  const docId = await savePendingDoc(chatId, { fileId, kind, mimeType, caption }, dateIso)
  if (!docId) {
    await sendMessage(chatId, '❌ Konnte das Dokument nicht zwischenspeichern. Bitte erneut senden.')
    return
  }
  await sendMessage(chatId, `📎 Dokument vom *${dateIso}* erhalten. Wohin?`, { parse_mode: 'Markdown', reply_markup: makeDocKeyboard(docId) })
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const secret = req.headers.get('x-telegram-bot-api-secret-token')
    if (secret !== WEBHOOK_SECRET) return NextResponse.json({ ok: true })

    const update: TelegramUpdate = await req.json()

    if (update.callback_query) {
      const cb = update.callback_query
      const chatId = cb.message?.chat.id
      await telegramPost('answerCallbackQuery', { callback_query_id: cb.id })
      if (!chatId || cb.from.id !== ALLOWED_USER_ID) return NextResponse.json({ ok: true })

      const parts = cb.data?.split(':') ?? []

      if (parts[0] === 'pl' && parts.length === 3) {
        const subfolder = parts[1] as PlanSubfolder
        const planRowId = parts[2]
        const pending = await popPendingDoc(planRowId)
        if (!pending) {
          await sendMessage(chatId, '❌ Plan abgelaufen — bitte erneut senden.')
          return NextResponse.json({ ok: true })
        }
        const today = serverDateKey()
        const entry = await savePlanEntry({ raw_text: pending.caption, date: today, subfolder })
        const label = subfolder === 'reisen' ? '🌍 Reisen' : '⚙️ Projekte'
        await sendMessage(chatId, `✓ Plan gespeichert → ${label} (${entry.category})`)
        return NextResponse.json({ ok: true })
      }

      if (parts[0] === 'doc' && parts.length === 3) {
        const target = parts[1] as 'GES' | 'VW'
        const file = await popPendingDoc(parts[2])
        if (!file) {
          await sendMessage(chatId, '❌ Dokument abgelaufen — bitte erneut senden.')
          return NextResponse.json({ ok: true })
        }
        await processDocChoice(target, file, chatId)
        return NextResponse.json({ ok: true })
      }

      if (parts[0] === 'hol' && parts.length === 2) {
        await sendDocumentById(chatId, parts[1])
        return NextResponse.json({ ok: true })
      }

      if (parts[0] === 's' && parts.length === 3) {
        const listId = parts[1]
        const pos = parseInt(parts[2], 10)
        const listEntry = shoppingLists.get(listId)
        const itemId = listEntry?.ids[pos]
        if (!itemId) {
          await sendMessage(chatId, '❌ Liste abgelaufen — bitte /liste erneut aufrufen.')
          return NextResponse.json({ ok: true })
        }
        const { error } = await supabaseAdmin.from('knowledge_entries').delete().eq('id', itemId).eq('user_id', 'me')
        if (error) console.error('[shop] delete error:', error)
        const remaining = await getShoppingItems()
        void updateObsidianShoppingList(remaining)
        const newListId = Math.random().toString(36).slice(2, 10)
        const { text: listText, keyboard } = buildShoppingMessage(remaining, newListId)
        const msgId = cb.message?.message_id
        if (msgId) {
          await telegramPost('editMessageText', {
            chat_id: chatId, message_id: msgId, text: listText, parse_mode: 'Markdown',
            ...(keyboard ? { reply_markup: keyboard } : { reply_markup: { inline_keyboard: [] } }),
          })
        }
        return NextResponse.json({ ok: true })
      }

      if (parts[0] !== 't' || parts.length !== 3) return NextResponse.json({ ok: true })
      const typeCode = parts[1] as TypeCode
      const pendingId = parts[2]
      const text = popPending(pendingId)
      if (!text) {
        await sendMessage(chatId, '❌ Nachricht nicht mehr verfügbar — bitte erneut senden.')
        return NextResponse.json({ ok: true })
      }
      await routeByType(typeCode, text, chatId)
      return NextResponse.json({ ok: true })
    }

    if (update.message) {
      const msg = update.message
      const chatId = msg.chat.id
      if (msg.from?.id !== ALLOWED_USER_ID) return NextResponse.json({ ok: true })

      // Photo (compressed image)
      if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1]
        await handleIncomingFile({ fileId: largest.file_id, kind: 'image', mimeType: 'image/jpeg', rawCaption: msg.caption ?? '' }, chatId)
        return NextResponse.json({ ok: true })
      }

      // Document (PDF, DOCX, XLSX, TXT, CSV, images sent as file)
      if (msg.document) {
        const mime = msg.document.mime_type ?? 'application/octet-stream'
        const kind = getSupportedKind(mime)
        if (!kind) {
          await sendMessage(
            chatId,
            `❌ Dieser Dateityp wird nicht unterstützt.\nUnterstützt: PDF, Word (DOCX), Excel (XLSX), Bilder, TXT, CSV`,
          )
          return NextResponse.json({ ok: true })
        }
        const label = mimeLabel(mime)
        await sendMessage(chatId, `📥 ${label} empfangen — einen Moment...`)
        await handleIncomingFile({ fileId: msg.document.file_id, kind, mimeType: mime, rawCaption: msg.caption ?? '' }, chatId)
        return NextResponse.json({ ok: true })
      }

      // Voice
      if (msg.voice) {
        await sendMessage(chatId, '🎙 Transkribiere...')
        let transcribed: string
        try {
          transcribed = await transcribeVoice(msg.voice.file_id)
        } catch (err) {
          console.error('[telegram] transcription error:', err)
          await sendMessage(chatId, `❌ Transkription fehlgeschlagen: ${String(err)}`)
          return NextResponse.json({ ok: true })
        }
        const pendingId = storePending(transcribed)
        await sendMessage(chatId, `📝 "${transcribed}"\n\nWohin soll ich das speichern?`, { reply_markup: makeKeyboard(pendingId) })
        return NextResponse.json({ ok: true })
      }

      // Text
      if (msg.text) {
        const lower = msg.text.trim().toLowerCase()

        const waiting = await getAwaitingDateDoc(chatId)
        if (waiting) {
          const dateIso = parseDateFromText(msg.text)
          if (!dateIso) {
            await sendMessage(chatId, '❌ Datum nicht erkannt. Format: *15.05.2026*', { parse_mode: 'Markdown' })
            return NextResponse.json({ ok: true })
          }
          await setPendingDocDate(waiting.id, dateIso)
          await sendMessage(chatId, `📎 Dokument vom *${dateIso}*. Wohin?`, { parse_mode: 'Markdown', reply_markup: makeDocKeyboard(waiting.id) })
          return NextResponse.json({ ok: true })
        }

        if (lower.startsWith('/hol')) {
          const query = msg.text.trim().slice(4).trim()
          await handleFetchCommand(chatId, query)
          return NextResponse.json({ ok: true })
        }

        if (lower === '/liste' || lower === 'liste') {
          const items = await getShoppingItems()
          const listId = Math.random().toString(36).slice(2, 10)
          const { text: listText, keyboard } = buildShoppingMessage(items, listId)
          await sendMessage(chatId, listText, { parse_mode: 'Markdown', ...(keyboard ? { reply_markup: keyboard } : {}) })
          return NextResponse.json({ ok: true })
        }

        const pendingId = storePending(msg.text)
        await sendMessage(chatId, `Wohin soll ich das speichern?\n\n"${msg.text}"`, { reply_markup: makeKeyboard(pendingId) })
        return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telegram] webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}

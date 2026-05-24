import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { saveKnowledgeEntry, saveNoteEntry } from '@/lib/knowledge'
import { createCalendarEvent } from '@/lib/googleCalendar'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_USER_ID ?? '0', 10)

const anthropic = new Anthropic()

// ── Calendar intent types ─────────────────────────────────────────────────────

interface ParsedCalendarIntent {
  action: 'CREATE' | 'UNKNOWN'
  title: string
  start_datetime: string       // ISO 8601 mit Berlin-Offset
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
  voice?: { file_id: string; duration: number; mime_type?: string }
}

interface TelegramCallbackQuery {
  id: string
  from: { id: number }
  message?: { chat: { id: number }; message_id: number }
  data?: string
}

// ── In-memory stores ──────────────────────────────────────────────────────────
// Personal bot: single user, low traffic — same warm instance handles
// button taps within seconds of the message arriving.

const pendingMessages = new Map<string, { text: string; expires: number }>()

// Maps listId → ordered array of Supabase UUIDs for ✅ callbacks
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
- Sprache: primär Deutsch, aber auch Englisch und gemischte Eingaben

## Ausgabe-Schema — NUR dieses JSON zurückgeben, keine Erklärung
{
  "action": "CREATE" | "UNKNOWN",
  "title": string,
  "start_datetime": string,        // ISO 8601 mit Offset, z.B. "2025-05-09T14:00:00+02:00"
  "end_datetime": string | null,
  "reminder_offset": number | null,
  "confidence": "high" | "medium" | "low",
  "raw_date_phrase": string
}

## Regeln

### action
- CREATE: User möchte Termin hinzufügen/erstellen/blocken/eintragen
  Signale: "trag ein", "füge hinzu", "block", "ich habe", "mach termin", "erinnere mich", "set", "add"
- UNKNOWN: Intent ist wirklich unklar — kein Termin erkennbar

### title
- Kurzer, kalender-tauglicher Titel (max 60 Zeichen)
- Füllwörter entfernen: "einen Termin", "eine Erinnerung", "dass ich"
- Ersten Buchstaben groß, Rest klein
- Aus Kontext ableiten falls kein klarer Titel (z.B. "Arzttermin", "Meeting mit Sarah")

### start_datetime
- Immer ISO 8601 mit Berlin-Offset zurückgeben (+01:00 CET / +02:00 CEST)
- Relative Datumsauflösung (${timestampIso} als Referenz):
  * "heute" → heute
  * "morgen" → heute + 1 Tag
  * "übermorgen" → heute + 2 Tage
  * "nächste Woche [Wochentag]" → nächste Woche diesen Wochentag
  * "diesen [Wochentag]" / "kommenden [Wochentag]" → nächstes Vorkommen
  * "in X Tagen/Wochen/Stunden" → entsprechendes Delta addieren
- Fuzzy-Zeitauflösung:
  * "morgens" / "früh" → 08:00
  * "vormittags" → 10:00
  * "mittags" → 12:00
  * "nachmittags" → 14:00
  * "abends" → 19:00
  * "nachts" → 21:00
  * Kein Zeitpunkt angegeben → 09:00 als Default
- Datum liegt in der Vergangenheit → nächstes Vorkommen annehmen

### end_datetime
- Nur befüllen wenn User explizit Dauer oder Endzeit nennt
- Sonst null

### reminder_offset
- Nur befüllen wenn User explizit Erinnerung wünscht
- In Minuten: "eine Stunde vorher" → 60, "30 Minuten vorher" → 30
- Sonst null

### confidence
- "high": klare Aktion, klarer Titel, explizites Datum und Uhrzeit
- "medium": Aktion und Titel klar, aber Datum/Zeit erfordert Inferenz
- "low": ein Element erforderte erhebliches Raten`
}

function formatDateTimeDE(isoString: string): { date: string; time: string } {
  const d = new Date(isoString)
  return {
    date: d.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      timeZone: 'Europe/Berlin',
    }),
    time: d.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin',
    }),
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
  const confidenceNote =
    parsed.confidence === 'low' ? '\n⚠️ Ich bin mir nicht ganz sicher — bitte kurz prüfen.' : ''

  let msg = `✅ *${parsed.title}*\n📅 ${start.date} um ${start.time} Uhr`
  if (parsed.end_datetime) {
    const end = formatDateTimeDE(parsed.end_datetime)
    msg += ` bis ${end.time} Uhr`
  }
  if (parsed.reminder_offset !== null) {
    const label =
      parsed.reminder_offset >= 60
        ? `${parsed.reminder_offset / 60}h`
        : `${parsed.reminder_offset}min`
    msg += `\n🔔 Erinnerung ${label} vorher`
  }
  return msg + confidenceNote
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function serverDateKey(): string {
  const tz = process.env.USER_TIMEZONE ?? 'Europe/Berlin'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
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
  const bullets = items.length > 0
    ? items.map((i) => `- [ ] ${i.raw_text}`).join('\n')
    : '_Liste ist leer_'
  const content = `---\nupdated: ${date}\n---\n\n# Aktuelle Einkaufsliste\n\n${bullets}\n`
  const encodedPath = `Einkauf-Anschaffungen/${encodeURIComponent('Aktuelle-Liste.md')}`

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
  // Store UUIDs so ✅ callbacks can look them up
  shoppingLists.set(listId, { ids: items.map((i) => i.id), expires: Date.now() + 30 * 60 * 1000 })
  for (const [k, v] of shoppingLists) {
    if (v.expires < Date.now()) shoppingLists.delete(k)
  }

  if (items.length === 0) {
    return { text: '🛒 Einkaufsliste ist leer.', keyboard: null }
  }

  const text = `🛒 *Einkaufsliste* (${items.length} Artikel)\n\n${items.map((i, n) => `${n + 1}. ${i.raw_text}`).join('\n')}`
  const keyboard = {
    inline_keyboard: items.map((item, idx) => [
      { text: `✅ ${item.raw_text}`, callback_data: `s:${listId}:${idx}` },
    ]),
  }
  return { text, keyboard }
}

// ── Telegram API ──────────────────────────────────────────────────────────────

async function telegramPost(method: string, body: object): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(`[telegram] ${method} failed:`, await res.text())
  }
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
        { text: '💡 Idee', callback_data: `t:ID:${pendingId}` },
        { text: '🍎 Essen', callback_data: `t:ES:${pendingId}` },
        { text: '📝 Notiz', callback_data: `t:NO:${pendingId}` },
      ],
      [
        { text: '🛒 Einkauf', callback_data: `t:EK:${pendingId}` },
        { text: '📅 Kalender', callback_data: `t:KA:${pendingId}` },
      ],
    ],
  }
}

async function transcribeVoice(fileId: string): Promise<string> {
  // 1. Get file path from Telegram
  const fileRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`,
  )
  const fileJson = await fileRes.json()
  if (!fileJson.ok) throw new Error(`getFile failed: ${JSON.stringify(fileJson)}`)
  const filePath: string = fileJson.result.file_path

  // 2. Download audio bytes
  const audioRes = await fetch(
    `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
  )
  if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`)
  const audioBuffer = await audioRes.arrayBuffer()

  // 3. Transcribe with OpenAI Whisper via multipart/form-data
  const formData = new FormData()
  const ext = filePath.split('.').pop() ?? 'ogg'
  formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), `audio.${ext}`)
  formData.append('model', 'whisper-1')

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: formData,
  })
  if (!whisperRes.ok) {
    throw new Error(`Whisper error: ${whisperRes.status} ${await whisperRes.text()}`)
  }
  const whisperJson = await whisperRes.json()
  return whisperJson.text as string
}

// ── Type routing ──────────────────────────────────────────────────────────────

type TypeCode = 'TR' | 'MU' | 'LE' | 'ID' | 'ES' | 'NO' | 'EK' | 'KA'

async function routeByType(
  typeCode: TypeCode,
  text: string,
  chatId: number,
): Promise<void> {
  const today = serverDateKey()

  switch (typeCode) {
    case 'TR': {
      const { error } = await supabaseAdmin
        .from('strength_sessions')
        .insert({ date: today, intensity: 2, notes: text, user_id: 'me' })
      if (error) console.error('[telegram] strength insert:', error)
      await sendMessage(chatId, '✓ Training geloggt — öffne Dashboard für Intensität')
      break
    }

    case 'MU': {
      const title = text.slice(0, 50)
      const { error } = await supabaseAdmin
        .from('music_projects')
        .insert({ title, status: 'idea', notes: text, user_id: 'me' })
      if (error) console.error('[telegram] music insert:', error)
      await sendMessage(chatId, '✓ Musikidee gespeichert')
      break
    }

    case 'LE': {
      await saveKnowledgeEntry({ raw_text: text, source: 'telegram', category: 'Zahnmedizin' })
      await sendMessage(chatId, '✓ Lernnotiz gespeichert → Zahnmedizin')
      break
    }

    case 'ID': {
      await saveKnowledgeEntry({ raw_text: text, source: 'telegram' })
      await sendMessage(chatId, '✓ Idee gespeichert → wird kategorisiert')
      break
    }

    case 'ES': {
      // Upsert: if today already has an entry, append to notes
      const { error: insertErr } = await supabaseAdmin
        .from('nutrition_logs')
        .insert({ date: today, notes: text, user_id: 'me' })

      if (insertErr) {
        const { data: existing } = await supabaseAdmin
          .from('nutrition_logs')
          .select('notes')
          .eq('date', today)
          .eq('user_id', 'me')
          .single()

        const updatedNotes = existing?.notes ? `${existing.notes}\n${text}` : text
        const { error: updateErr } = await supabaseAdmin
          .from('nutrition_logs')
          .update({ notes: updatedNotes })
          .eq('date', today)
          .eq('user_id', 'me')
        if (updateErr) console.error('[telegram] nutrition update:', updateErr)
      }

      await sendMessage(chatId, '✓ Mahlzeit notiert — öffne Dashboard für Makros')
      break
    }

    case 'NO': {
      const entry = await saveNoteEntry({ raw_text: text, date: today })
      await sendMessage(chatId, `✓ Notiz gespeichert → ${entry.category}`)
      break
    }

    case 'EK': {
      const { error } = await supabaseAdmin
        .from('knowledge_entries')
        .insert({ raw_text: text, category: 'Einkauf', summary: text.slice(0, 80), tags: ['einkauf'], source: 'einkauf', user_id: 'me' })
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
          await createCalendarEvent({
            title: parsed.title,
            startIso: parsed.start_datetime,
            endIso: parsed.end_datetime,
            reminderMinutes: parsed.reminder_offset,
          })
          await sendMessage(chatId, buildCalendarFeedback(parsed), { parse_mode: 'Markdown' })
        } else {
          await sendMessage(
            chatId,
            '❌ Konnte keinen Termin erkennen. Bitte konkreter formulieren (z.B. "Morgen um 15 Uhr Meeting mit Jonas").',
          )
        }
      } catch (err) {
        console.error('[telegram] calendar error:', err)
        await sendMessage(chatId, `❌ Kalender-Fehler: ${String(err)}`)
      }
      break
    }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Always return 200 to Telegram — never let the webhook time out
  try {
    const secret = req.headers.get('x-telegram-bot-api-secret-token')
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: true })
    }

    const update: TelegramUpdate = await req.json()

    // ── Callback query (button tap) ──────────────────────────────────────────
    if (update.callback_query) {
      const cb = update.callback_query
      const chatId = cb.message?.chat.id

      // Acknowledge immediately so Telegram removes the loading spinner
      await telegramPost('answerCallbackQuery', { callback_query_id: cb.id })

      if (!chatId || cb.from.id !== ALLOWED_USER_ID) {
        return NextResponse.json({ ok: true })
      }

      const parts = cb.data?.split(':') ?? []

      // Shopping list check-off: s:{listId}:{pos}
      if (parts[0] === 's' && parts.length === 3) {
        const listId = parts[1]
        const pos = parseInt(parts[2], 10)
        const listEntry = shoppingLists.get(listId)
        const itemId = listEntry?.ids[pos]

        if (!itemId) {
          await sendMessage(chatId, '❌ Liste abgelaufen — bitte /liste erneut aufrufen.')
          return NextResponse.json({ ok: true })
        }

        const { error } = await supabaseAdmin
          .from('knowledge_entries')
          .delete()
          .eq('id', itemId)
          .eq('user_id', 'me')
        if (error) console.error('[shop] delete error:', error)

        const remaining = await getShoppingItems()
        void updateObsidianShoppingList(remaining)

        const newListId = Math.random().toString(36).slice(2, 10)
        const { text: listText, keyboard } = buildShoppingMessage(remaining, newListId)
        const msgId = cb.message?.message_id
        if (msgId) {
          await telegramPost('editMessageText', {
            chat_id: chatId,
            message_id: msgId,
            text: listText,
            parse_mode: 'Markdown',
            ...(keyboard ? { reply_markup: keyboard } : { reply_markup: { inline_keyboard: [] } }),
          })
        }
        return NextResponse.json({ ok: true })
      }

      // Type routing: t:{TYPE}:{pendingId}
      if (parts[0] !== 't' || parts.length !== 3) {
        return NextResponse.json({ ok: true })
      }

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

    // ── Regular message ──────────────────────────────────────────────────────
    if (update.message) {
      const msg = update.message
      const chatId = msg.chat.id

      if (msg.from?.id !== ALLOWED_USER_ID) {
        return NextResponse.json({ ok: true })
      }

      // Voice message
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
        await sendMessage(chatId, `📝 "${transcribed}"\n\nWohin soll ich das speichern?`, {
          reply_markup: makeKeyboard(pendingId),
        })
        return NextResponse.json({ ok: true })
      }

      // Text message
      if (msg.text) {
        const lower = msg.text.trim().toLowerCase()

        // /liste command — show shopping list with check-off buttons
        if (lower === '/liste' || lower === 'liste') {
          const items = await getShoppingItems()
          const listId = Math.random().toString(36).slice(2, 10)
          const { text: listText, keyboard } = buildShoppingMessage(items, listId)
          await sendMessage(chatId, listText, {
            parse_mode: 'Markdown',
            ...(keyboard ? { reply_markup: keyboard } : {}),
          })
          return NextResponse.json({ ok: true })
        }

        const pendingId = storePending(msg.text)
        await sendMessage(chatId, `Wohin soll ich das speichern?\n\n"${msg.text}"`, {
          reply_markup: makeKeyboard(pendingId),
        })
        return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telegram] webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}

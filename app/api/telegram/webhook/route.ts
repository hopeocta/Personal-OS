import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { saveKnowledgeEntry, saveNoteEntry } from '@/lib/knowledge'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_USER_ID ?? '0', 10)

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

// ── Pending message store ─────────────────────────────────────────────────────
// Personal bot: single user, low traffic — same warm instance handles
// the button tap within seconds of the voice/text arriving.

const pendingMessages = new Map<string, { text: string; expires: number }>()

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

type TypeCode = 'TR' | 'MU' | 'LE' | 'ID' | 'ES' | 'NO'

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

      const parts = cb.data?.split(':') // ['t', 'TR', 'a1b2c3d4']
      if (!parts || parts.length !== 3 || parts[0] !== 't') {
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

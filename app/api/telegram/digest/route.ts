import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_USER_ID = process.env.TELEGRAM_USER_ID

function serverDateKey(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function isoWeek(date: Date, tz: string): string {
  const d = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date))
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

async function sendTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !TELEGRAM_USER_ID) return
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_USER_ID, text, parse_mode: 'Markdown' }),
  })
  if (!res.ok) console.error('[digest] Telegram send failed:', await res.text())
}

async function writeToObsidian(filepath: string, content: string): Promise<void> {
  const obsidianUrl = process.env.OBSIDIAN_API_URL
  const obsidianKey = process.env.OBSIDIAN_API_KEY
  if (!obsidianUrl || !obsidianKey) return
  const encodedPath = filepath.split('/').map(encodeURIComponent).join('/')
  try {
    const res = await fetch(`${obsidianUrl}/vault/${encodedPath}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${obsidianKey}`, 'Content-Type': 'text/markdown' },
      body: content,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) console.error('[digest] Obsidian write failed:', res.status)
  } catch (err) {
    console.error('[digest] Obsidian unreachable:', err)
  }
}

async function runDailyDigest(tz: string): Promise<string> {
  const today = serverDateKey(tz)

  const { data: notes, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('raw_text, category, summary, created_at')
    .eq('source', 'telegram_note')
    .gte('created_at', `${today}T00:00:00+00:00`)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!notes || notes.length === 0) return 'Keine Notizen heute.'

  const notesText = notes
    .map((n) => `[${n.category}] ${n.raw_text}`)
    .join('\n\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `Du erstellst eine tägliche Zusammenfassung persönlicher Sprachnotizen.
Gruppiere nach Kategorien und schreibe prägnante Bullet Points auf Deutsch.
Format: eine Zeile pro Notiz, mit Emoji passend zur Kategorie.
Halte es kurz und klar — kein Bullshit, nur die Kernaussagen.`,
    messages: [{ role: 'user', content: `Notizen vom ${today}:\n\n${notesText}` }],
  })

  const summary =
    msg.content.find((c) => c.type === 'text')?.type === 'text'
      ? (msg.content.find((c) => c.type === 'text') as { type: 'text'; text: string }).text
      : notesText

  // Save as daily_digest entry
  await supabaseAdmin.from('knowledge_entries').insert({
    raw_text: summary,
    category: 'Allgemein',
    summary: `Tages-Digest ${today}`,
    tags: ['digest', 'daily', today],
    source: 'daily_digest',
    user_id: 'me',
  })

  // Write to Obsidian
  const obsidianContent = `---\ndate: ${today}\ntype: daily_digest\n---\n\n# Tages-Digest ${today}\n\n${summary}`
  void writeToObsidian(`Logbuch/Zusammenfassungen/${today}-digest.md`, obsidianContent)

  return summary
}

async function runWeeklyDigest(tz: string): Promise<string> {
  const today = serverDateKey(tz)
  const week = isoWeek(new Date(), tz)

  // Fetch all daily digests from this week
  const { data: digests, error } = await supabaseAdmin
    .from('knowledge_entries')
    .select('raw_text, created_at')
    .eq('source', 'daily_digest')
    .contains('tags', ['digest'])
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!digests || digests.length === 0) return 'Keine Tages-Digests diese Woche.'

  const digestsText = digests
    .map((d, i) => `Tag ${i + 1}:\n${d.raw_text}`)
    .join('\n\n---\n\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 768,
    system: `Du erstellst eine wöchentliche Zusammenfassung aus Tages-Digests.
Fasse Themen und Muster der Woche zusammen. Antworte auf Deutsch.
Struktur: kurze Einleitung, dann Bullet Points nach Bereichen, dann ein Satz Ausblick.`,
    messages: [{ role: 'user', content: `Woche ${week} — Tages-Digests:\n\n${digestsText}` }],
  })

  const summary =
    msg.content.find((c) => c.type === 'text')?.type === 'text'
      ? (msg.content.find((c) => c.type === 'text') as { type: 'text'; text: string }).text
      : digestsText

  // Save as weekly_digest entry
  await supabaseAdmin.from('knowledge_entries').insert({
    raw_text: summary,
    category: 'Allgemein',
    summary: `Wochen-Digest ${week}`,
    tags: ['digest', 'weekly', week],
    source: 'weekly_digest',
    user_id: 'me',
  })

  // Write to Obsidian
  const obsidianContent = `---\nweek: ${week}\ntype: weekly_digest\n---\n\n# Wochen-Digest ${week}\n\n${summary}`
  void writeToObsidian(`Logbuch/Wochen/${week}-digest.md`, obsidianContent)

  return summary
}

// GET is used by Vercel cron; POST is available for manual testing
async function handleDigest(type: string | null): Promise<NextResponse> {
  const tz = process.env.USER_TIMEZONE ?? 'Europe/Berlin'

  try {
    if (type === 'daily') {
      const summary = await runDailyDigest(tz)
      const today = serverDateKey(tz)
      await sendTelegram(`📋 *Tages-Digest ${today}*\n\n${summary}`)
      return NextResponse.json({ ok: true, type: 'daily' })
    }

    if (type === 'weekly') {
      const week = isoWeek(new Date(), tz)
      const summary = await runWeeklyDigest(tz)
      await sendTelegram(`📊 *Wochen-Digest ${week}*\n\n${summary}`)
      return NextResponse.json({ ok: true, type: 'weekly' })
    }

    return NextResponse.json({ error: 'type must be daily or weekly' }, { status: 400 })
  } catch (err) {
    console.error('[digest] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const type = req.nextUrl.searchParams.get('type')
  return handleDigest(type)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { type } = await req.json()
  return handleDigest(type)
}

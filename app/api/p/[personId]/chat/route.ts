import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { owlChat, type ChatMessage } from '@/lib/openrouter'

export const runtime = 'nodejs'
export const maxDuration = 30

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function berlinToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}

function formatDate(str: string) {
  const d = new Date(str + 'T12:00:00')
  return `${WOCHENTAGE[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params
  const body = await req.json().catch(() => ({}))
  const message: string = typeof body.message === 'string' ? body.message.trim() : ''
  const history: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(body.history)
    ? body.history
    : []

  if (!message) return NextResponse.json({ error: 'Keine Nachricht' }, { status: 400 })

  // 1. Person-Profil
  const { data: person } = await supabaseAdmin
    .from('persons')
    .select('display_name, goal, age, hf_max, hf_rest, hr_zones, profile_notes, sport_focus, weekly_hours')
    .eq('id', personId)
    .single()

  if (!person) return NextResponse.json({ error: 'Person nicht gefunden' }, { status: 404 })

  // 2. Plan nächste 4 Wochen
  const today = berlinToday()
  const endDate = new Date(today + 'T12:00:00')
  endDate.setDate(endDate.getDate() + 28)
  const endStr = endDate.toISOString().slice(0, 10)

  const { data: sessions } = await supabaseAdmin
    .from('training_plan_sessions')
    .select('id, date, sport, title, duration_min, hf_zone, hf_range, details, is_optional, is_event, intensity_kind, completed_at')
    .eq('user_id', personId)
    .gte('date', today)
    .lte('date', endStr)
    .order('date')

  // 3. System-Prompt aufbauen
  const hrZones = person.hr_zones as Record<string, unknown> | null
  const zonesText = hrZones
    ? Object.entries(hrZones)
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
        .join('\n')
    : '  (keine Zonen hinterlegt)'

  const sessionsText =
    (sessions ?? [])
      .map((s) => {
        const opt = s.is_optional ? ' [optional]' : ''
        const done = s.completed_at ? ' ✓erledigt' : ''
        const hf = s.hf_range ? ` ${s.hf_range}` : ''
        return `  ${formatDate(s.date)} ${s.date} — ${s.title} | ${s.duration_min} min | HF ${s.hf_zone}${hf}${opt}${done} | ID:${s.id}`
      })
      .join('\n') || '  (keine Einheiten geplant)'

  const systemPrompt = `Du bist der persönliche Trainingsassistent von ${person.display_name ?? personId}.
Heute: ${formatDate(today)} (${today})

ATHLETEN-PROFIL:
  Name: ${person.display_name ?? personId}
  Alter: ${person.age ?? '?'} Jahre | HFmax: ${person.hf_max ?? '?'} bpm | Ruhepuls: ${person.hf_rest ?? '?'} bpm
  Ziel: ${person.goal ?? '?'}
  Sportfokus: ${person.sport_focus ?? '?'} | Wochenstunden: ${person.weekly_hours ?? '?'}

HF-ZONEN:
${zonesText}

ANALYSE-ERKENNTNISSE:
  ${person.profile_notes ?? '(keine Notizen)'}

TRAININGSPLAN NÄCHSTE 4 WOCHEN:
${sessionsText}

DEINE AUFGABE:
Sei ein freundlicher, natürlicher Trainingsassistent. Beantworte alle Fragen auf Deutsch — locker und direkt, nicht steif. Fragen zu Training, HF-Zonen, Pace, Wettkampf, Regeneration — alles ist erlaubt.

Wenn die Athletin eine Einheit verschieben möchte, schreib am Ende deiner Antwort eine Zeile exakt so:
VERSCHIEBE: <sessionId>|<vonDatum YYYY-MM-DD>|<nachDatum YYYY-MM-DD>

Beispiel: VERSCHIEBE: abc-123|2026-06-25|2026-06-23

Sonst: nur normalen Text antworten, kein JSON, kein Markdown.`

  // 4. Gespräch zusammenbauen (max. letzte 10 Nachrichten)
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  // 5. Owl Alpha
  const raw = await owlChat(messages, { maxTokens: 800 })

  // 6. VERSCHIEBE-Zeile rausparsen wenn vorhanden
  const moveMatch = raw.match(/VERSCHIEBE:\s*([^\|]+)\|(\d{4}-\d{2}-\d{2})\|(\d{4}-\d{2}-\d{2})/)
  const answer = raw.replace(/\nVERSCHIEBE:.*$/m, '').trim()

  let action: unknown = null
  if (moveMatch) {
    const sessionId = moveMatch[1].trim()
    const fromDate = moveMatch[2]
    const toDate = moveMatch[3]
    const session = (sessions ?? []).find((s) => s.id === sessionId)
    action = {
      type: 'move',
      sessionId,
      sessionTitle: session?.title ?? 'Einheit',
      fromDate,
      toDate,
    }
  }

  return NextResponse.json({ answer, action })
}

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

  const systemPrompt = `Du bist Trainingsassistent von ${person.display_name ?? personId}.
Heute: ${formatDate(today)} (${today})

ATHLETEN-PROFIL:
  Name: ${person.display_name ?? personId}
  Alter: ${person.age ?? '?'} | HFmax: ${person.hf_max ?? '?'} bpm | Ruhepuls: ${person.hf_rest ?? '?'} bpm
  Ziel: ${person.goal ?? '?'}
  Sportfokus: ${person.sport_focus ?? '?'} | Wochenstunden: ${person.weekly_hours ?? '?'}

HF-ZONEN:
${zonesText}

ANALYSE-ERKENNTNISSE:
  ${person.profile_notes ?? '(keine Notizen)'}

TRAININGSPLAN NÄCHSTE 4 WOCHEN:
${sessionsText}

KOMMUNIKATION:
Direkt, klar, präzise. Kein Smalltalk, keine Emojis. Antworte auf Deutsch. Unterstützend aber sachlich — wie ein erfahrener Trainer, kein Cheerleader. Kurze Antworten bevorzugt, Details nur wenn gefragt.

TRAININGSWISSEN (immer anwenden):

Puls-Drift beim Laufen:
- Schrittweiser HF-Anstieg bei gleicher Pace = kardiale Drift, normal ab 30-40 min bei Hitze/Ermüdung
- Konsequenz: Pace reduzieren bis HF-Ziel wieder stimmig, nicht Pace halten
- Bei starker Drift (>10 bpm) → Einheit abbrechen oder stark reduzieren
- Unterschied zu echter Erschöpfung: Drift ist graduell und gleichmäßig

Hitze (ab ca. 25°C):
- Leistungsverlust ~3-5% pro 5°C über 20°C
- HF-Zielwert bleibt, Pace sinkt — Pace-Vorgaben nicht erzwingen
- Hydration: 500-750ml/h, bei >30°C Salz
- Früh morgens oder abends trainieren, Indoor-Alternative bevorzugen

Aufwärmen:
- Laufen: 10-15 min Z1 (lockeres Einlaufen), dann 3-4 Strides (10 sek Beschleunigen)
- Rad Indoor: 10 min Leistungsaufbau 40%→60% FTP, Kadenz 90-100 RPM
- Schwimmen: 200-400m gemischt (Kraul, Rücken, Kraulbeine)
- Kraft: 5-10 min Mobilisation + 1-2 Aufwärmsätze pro Übung

Auslaufen/Regeneration:
- 5-10 min Z1 nach jeder intensiven Einheit (Laktat abbau)
- Nach Wettkampf: 10-15 min sehr locker
- Dehnroutine erst wenn Körper warm (nach dem Auslaufen)

Rad Kadenz (Allgemein):
- Grundlage/Z2: 85-95 RPM — effizient, schont Muskulatur
- Intervalle/Schwelle: 95-105 RPM — metabolisch günstiger
- Bergauf/Krafteinheiten: 60-75 RPM gezielt
- Niedrige Kadenz (unter 75) bei längerem Effort = erhöhte Muskelermüdung

Indoor Rad — Leistungssteuerung:
- Basis ist FTP (Functional Threshold Power)
- Z2 = 56-75% FTP | Z3 Tempo = 76-90% FTP | Z4 Schwelle = 91-105% FTP | Z5 VO2max = 106-120% FTP
- Watt-Angaben im Plan beziehen sich auf diese Zonen
- Kadenz-Variation trainiert neuromuskuläre Effizienz (z.B. 2 min hoch / 2 min niedrig)

Wenn die Athletin eine Einheit verschieben möchte, schreib am Ende deiner Antwort:
VERSCHIEBE: <sessionId>|<vonDatum YYYY-MM-DD>|<nachDatum YYYY-MM-DD>

Nur normalen Text antworten, kein JSON, kein Markdown.`

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

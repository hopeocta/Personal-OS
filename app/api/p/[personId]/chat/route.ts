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
    .select('display_name, goal, age, hf_max, hf_rest, hr_zones, profile_notes, sport_focus, weekly_hours, data_source, lthr_run, lthr_bike, hr_max_run, hr_max_bike, hr_zones_run, hr_zones_bike, race_date, race_type')
    .eq('id', personId)
    .single()

  if (!person) return NextResponse.json({ error: 'Person nicht gefunden' }, { status: 404 })

  const isTP = person.data_source === 'tp'

  // TP-spezifisch: WHOOP + letzte Aktivitäten
  let whoopToday: number | null = null
  let recentActivities: string[] = []
  if (isTP) {
    const { data: wellness } = await supabaseAdmin
      .from('tp_wellness')
      .select('date, whoop_recovery_score, hrv_ms, resting_hr, sleep_total_h, recovery_label')
      .eq('person_id', personId)
      .order('date', { ascending: false })
      .limit(3)
    if (wellness?.[0]) {
      const w = wellness[0]
      whoopToday = w.whoop_recovery_score
    }
    const { data: acts } = await supabaseAdmin
      .from('tp_activities')
      .select('workout_day, sport, title, duration_actual_h, tss_actual, hr_avg, status')
      .eq('person_id', personId)
      .eq('status', 'completed')
      .order('workout_day', { ascending: false })
      .limit(7)
    recentActivities = (acts ?? []).map(a =>
      `  ${a.workout_day} — ${a.sport} | ${a.title} | ${a.duration_actual_h ? Math.round(Number(a.duration_actual_h) * 60) + ' min' : '?'} | TSS: ${a.tss_actual ? Math.round(Number(a.tss_actual)) : '?'} | HF: ${a.hr_avg ?? '?'} bpm`
    )
  }

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

  const tpBlock = isTP ? `
LEISTUNGSPARAMETER (TrainingPeaks):
  FTP Rad: 230 W (Zwift Ramp Test Sep 2024)
  LTHR Laufen: ${person.lthr_run ?? 165} bpm (aus Renndaten)
  LTHR Rad: ${person.lthr_bike ?? 152} bpm
  HFmax Laufen: ${person.hr_max_run ?? 193} bpm

WATT-ZONEN RAD (FTP=230W):
  Z1 Erholung:  115–161 W
  Z2 Grundlage: 161–191 W (85–100 RPM, KH 0.8–1.2g/kg)
  Z3 Schwelle:  209–230 W
  Z4 VO2max:    235–253 W
  Antritte:     >253 W (max 6×12sek)

HF-ZONEN LAUFEN (LTHR=165):
  Z1: <132 bpm | Z2: 132–148 | Z3: 149–164 | Z4: 165–173 | Z5: >173

WHOOP RECOVERY HEUTE: ${whoopToday !== null ? `${whoopToday}/100 (${whoopToday >= 67 ? 'grün' : whoopToday >= 34 ? 'gelb' : 'rot'})` : 'keine Daten'}
  → Optionale Einheiten: ${whoopToday !== null && whoopToday >= 67 ? 'freigegeben' : 'nur wenn wirklich frisch'}

LETZTE 7 AKTIVITÄTEN:
${recentActivities.length > 0 ? recentActivities.join('\n') : '  (keine aktuellen Daten)'}

WETTKAMPFZIEL: Sprint-Triathlon ${person.race_date ?? '20.09.2026'} (750m/20km/5km)
` : ''

  const systemPrompt = `Du bist Trainingsassistent von ${person.display_name ?? personId}.
Heute: ${formatDate(today)} (${today})

ATHLETEN-PROFIL:
  Name: ${person.display_name ?? personId} | Alter: ${person.age ?? '?'}
  Ziel: ${person.goal ?? 'Triathlon'} | Sport: ${person.sport_focus ?? '?'}
  ${!isTP ? `HFmax: ${person.hf_max ?? '?'} bpm | Ruhepuls: ${person.hf_rest ?? '?'} bpm` : ''}
${tpBlock}
HF-ZONEN:
${zonesText}

PROFIL-NOTIZEN:
  ${person.profile_notes ?? '(keine)'}

TRAININGSPLAN NÄCHSTE 4 WOCHEN:
${sessionsText}

KOMMUNIKATION:
Direkt, klar, ohne Smalltalk. Deutsch. Wie ein erfahrener Trainer — sachlich, nicht überschwänglich. Kurze Antworten, Details nur wenn gefragt. Keine Emojis.

TRAININGSWISSEN:

Laufen HF-Zonen (gilt für ${person.display_name ?? personId}):
- Z2 (Grundlage): 132–148 bpm — fühlt sich sehr locker an, sollte so sein
- Z4 (Schwelle): 165–173 bpm — 60-min-Renntempo
- Grauzone (149–164): meiden im Training! Weder Erholung noch Reiz
- Drift: bei Anstieg >10 bpm über Ziel → Tempo senken, nicht halten

Rad Watt-Steuerung:
- Z2 = 161–191W, Kadenz 85–100 RPM, locker
- Over-Unders = 1min@219W / 1min@242W wechselnd
- FTP-Blöcke = 207–219W, 85–90 RPM
- Antritte (Breakaway) = stehend, schwerem Gang, max 12sek, 90–95% Maximum

Brick-Training:
- Letzten 5min Rad: Kadenz auf 110 RPM hochschrauben, Watt senken
- Erste 5min Lauf: sehr locker — "tote Beine" sind normal
- Ziel: Neuromuskuläre Umschaltung trainieren

Wenn er eine Einheit verschieben möchte, schreib am Ende:
VERSCHIEBE: <sessionId>|<vonDatum YYYY-MM-DD>|<nachDatum YYYY-MM-DD>

Nur normalen Text, kein JSON, kein Markdown.`

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

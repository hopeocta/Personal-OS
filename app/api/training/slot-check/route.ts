import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const date: string | undefined = body?.date
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Datum fehlt (YYYY-MM-DD)' }, { status: 400 })
  }

  const dayBefore = addDays(date, -1)
  const dayAfter = addDays(date, 1)
  const fiveDaysAgo = addDays(date, -5)

  const [
    { data: training },
    { data: bbRows },
    { data: sleepRows },
    { data: planSessions },
    { data: recentActivities },
    { data: person },
  ] = await Promise.all([
    supabaseAdmin
      .from('garmin_training')
      .select('date, ctl, atl, acwr, acwr_status, training_status, vo2max')
      .eq('user_id', 'me')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('garmin_body_battery')
      .select('date, morning_value')
      .eq('user_id', 'me')
      .order('date', { ascending: false })
      .limit(3),
    supabaseAdmin
      .from('garmin_sleep')
      .select('date, sleep_score, total_sleep_min, deep_sleep_min, hrv_avg')
      .eq('user_id', 'me')
      .not('sleep_score', 'is', null)
      .order('date', { ascending: false })
      .limit(2),
    supabaseAdmin
      .from('training_plan_sessions')
      .select('date, sport, title, duration_min, hf_zone, intensity_kind, is_optional')
      .eq('user_id', 'me')
      .in('date', [dayBefore, date, dayAfter])
      .order('date'),
    supabaseAdmin
      .from('garmin_activities')
      .select('date, type, duration_min, avg_hr, distance_km, name')
      .eq('user_id', 'me')
      .gte('date', fiveDaysAgo)
      .lte('date', date)
      .order('date', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('persons')
      .select('lthr_run, lthr_bike, ftp_w, hf_max, hr_zones, weekly_hours')
      .eq('id', 'me')
      .maybeSingle(),
  ])

  // Datenkomprimierung für Haiku-Prompt
  const tr = training
  const bb = bbRows?.[0]?.morning_value ?? bbRows?.[1]?.morning_value ?? null
  const sleep = sleepRows?.[0]

  function fmtSession(s: { date: string; sport: string; title: string; duration_min: number | null; hf_zone: string | null; intensity_kind: string | null; is_optional: boolean } | null | undefined): string {
    if (!s) return 'nichts geplant'
    const opt = s.is_optional ? ' (optional)' : ''
    const dur = s.duration_min ? ` ${s.duration_min}min` : ''
    const zone = s.hf_zone ? ` ${s.hf_zone}` : ''
    const kind = s.intensity_kind ? ` [${s.intensity_kind}]` : ''
    return `${s.sport}${dur}${zone}${kind}${opt} — "${s.title}"`
  }

  const sessionsOnDate = (planSessions ?? []).filter((s) => s.date === date)
  if (sessionsOnDate.length > 0) {
    return NextResponse.json({
      machbar: false,
      ampel: 'grau',
      einheit: null,
      begruendung: 'An diesem Tag ist bereits eine Einheit geplant.',
    })
  }

  const before = (planSessions ?? []).filter((s) => s.date === dayBefore)
  const after = (planSessions ?? []).filter((s) => s.date === dayAfter)
  const beforeStr = before.length ? before.map(fmtSession).join(', ') : 'frei'
  const afterStr = after.length ? after.map(fmtSession).join(', ') : 'frei'

  const recentStr = (recentActivities ?? [])
    .map((a) => {
      const dur = a.duration_min ? `${Math.round(a.duration_min as number)}min` : ''
      const hr = a.avg_hr ? ` Ø${a.avg_hr}bpm` : ''
      const km = a.distance_km ? ` ${(a.distance_km as number).toFixed(1)}km` : ''
      return `${a.date} ${a.type}${dur}${hr}${km}`
    })
    .join('\n')

  const ctlStr = tr?.ctl ? Math.round(tr.ctl as number).toString() : '?'
  const atlStr = tr?.atl ? Math.round(tr.atl as number).toString() : '?'
  const acwrStr = tr?.acwr ? (tr.acwr as number).toFixed(2) : '?'
  const acwrStatus = tr?.acwr_status ?? tr?.training_status ?? '?'
  const sleepStr = sleep
    ? `Score ${sleep.sleep_score}/100, ${Math.round((sleep.total_sleep_min as number) / 60 * 10) / 10}h Schlaf, ${sleep.deep_sleep_min ? `${sleep.deep_sleep_min}min Tiefschlaf` : ''}, HRV ${sleep.hrv_avg ?? '?'}ms`
    : 'keine Daten'

  const prompt = `Du bist ein erfahrener Triathlon-Coach. Ich habe am ${date} einen freien Tag und überlege ob ich eine Zusatzeinheit einbaue.

TRAININGSZUSTAND (Garmin, aktuell):
- CTL (Fitness-Level): ${ctlStr}
- ATL (kurzfristige Ermüdung): ${atlStr}
- ACWR (Belastungsverhältnis): ${acwrStr} → ${acwrStatus}
- VO2max: ${tr?.vo2max ?? '?'}

ERHOLUNG:
- Body Battery morgens: ${bb !== null ? `${bb}%` : 'keine Daten'}
- Schlaf letzte Nacht: ${sleepStr}

PLAN RUND UM DEN FREIEN TAG:
- Gestern (${dayBefore}): ${beforeStr}
- Heute frei (${date}): —
- Morgen (${dayAfter}): ${afterStr}

LETZTE AKTIVITÄTEN (5 Tage):
${recentStr || 'keine'}

ATHLETENPROFIL:
- LTHR Laufen: ${person?.lthr_run ?? '?'} bpm
- LTHR Rad: ${person?.lthr_bike ?? '?'} bpm
- FTP: ${person?.ftp_w ?? '?'} W

Entscheide ob eine Zusatzeinheit Sinn macht. Sei konservativ: lieber nein als Übertraining riskieren.

Antworte NUR als JSON (kein Text davor/danach):
{
  "machbar": true oder false,
  "ampel": "grün" (gut) | "gelb" (vorsicht, kurz+locker) | "rot" (besser pausieren),
  "einheit": {
    "sport": "swim" | "bike" | "run" | "strength",
    "intensitaet": "locker" | "moderat",
    "dauer_min": Zahl,
    "zone": "Z1" | "Z1-Z2" | "Z2",
    "titel": "kurzer Titel der Einheit",
    "beschreibung": "2-3 Sätze: was genau tun, warum passt das, was beachten"
  },
  "begruendung": "1-2 Sätze warum ja/nein, welche Kennzahlen ausschlaggebend waren"
}

Wenn machbar=false: einheit kann null sein.`

  let result: {
    machbar: boolean
    ampel: string
    einheit: { sport: string; intensitaet: string; dauer_min: number; zone: string; titel: string; beschreibung: string } | null
    begruendung: string
  } | null = null

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    result = JSON.parse(jsonStr)
  } catch (e) {
    console.error('[slot-check] Claude/parse error:', e)
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json(result)
}

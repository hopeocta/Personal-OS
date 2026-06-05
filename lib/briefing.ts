import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchCalendarEvents, isExamEvent, isTrainingEvent } from '@/lib/calendar'
import { queryMetric } from '@/lib/metrics'
import { berlinDateKey, berlinTz, germanLongDate } from '@/lib/berlinDate'
import { dueTasks } from '@/lib/tasks'
import type { CalendarEvent, GarminActivity, GarminSleep, GarminBodyBattery, GarminTraining } from '@/lib/types'

export type BriefingResult = {
  dateKey: string
  markdown: string
  telegramText: string
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function activityLabel(type: string | null): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('swim')) return '🏊'
  if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) return '🚴'
  if (t.includes('run')) return '🏃'
  if (t.includes('strength')) return '💪'
  return '🏋'
}

function sumTriathlon(activities: GarminActivity[]) {
  let swimKm = 0
  let bikeKm = 0
  let runKm = 0
  let totalMin = 0
  let sessions = 0
  for (const a of activities) {
    sessions++
    totalMin += a.duration_min ?? 0
    const t = (a.type ?? '').toLowerCase()
    const km = a.distance_km ?? 0
    if (t.includes('swim')) swimKm += km
    else if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) bikeKm += km
    else if (t.includes('run')) runKm += km
  }
  return {
    sessions,
    swimKm: Math.round(swimKm * 10) / 10,
    bikeKm: Math.round(bikeKm * 10) / 10,
    runKm: Math.round(runKm * 10) / 10,
    totalHours: Math.round((totalMin / 60) * 10) / 10,
  }
}

async function latestSleep(dateKey: string): Promise<GarminSleep | null> {
  const keys = [dateKey, berlinDateKey(-1), berlinDateKey(-2)]
  for (const d of keys) {
    const { data } = await supabaseAdmin
      .from('garmin_sleep')
      .select('*')
      .eq('date', d)
      .maybeSingle()
    if (data?.sleep_score != null) return data as GarminSleep
  }
  return null
}

async function latestBodyBattery(dateKey: string): Promise<GarminBodyBattery | null> {
  const keys = [dateKey, berlinDateKey(-1)]
  for (const d of keys) {
    const { data } = await supabaseAdmin
      .from('garmin_body_battery')
      .select('*')
      .eq('date', d)
      .maybeSingle()
    if (data?.morning_score != null) return data as GarminBodyBattery
  }
  return null
}

async function latestTrainingLoad(): Promise<GarminTraining | null> {
  const { data } = await supabaseAdmin
    .from('garmin_training')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as GarminTraining) ?? null
}

function formatTimeBerlin(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: process.env.USER_TIMEZONE ?? 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** Tag-relatives Label für ein Event: „heute 18:00“, „morgen 07:00“, „Mo 09:00“. */
function relativeWhen(ev: CalendarEvent): string {
  const tz = berlinTz()
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(ev.start))
  let day: string
  if (key === berlinDateKey()) day = 'heute'
  else if (key === berlinDateKey(1)) day = 'morgen'
  else day = new Intl.DateTimeFormat('de-DE', { timeZone: tz, weekday: 'short' }).format(new Date(ev.start))
  return ev.allDay ? day : `${day} ${formatTimeBerlin(ev.start)}`
}

/** Nächste Trainingseinheit aus dem Kalender (heute ab jetzt bis +7 Tage). */
async function nextTrainingEvent(): Promise<CalendarEvent | null> {
  try {
    const upcoming = await fetchCalendarEvents(new Date(), new Date(Date.now() + 7 * 86400000))
    return upcoming.find((e) => isTrainingEvent(e.title)) ?? null
  } catch (err) {
    console.error('[briefing] upcoming calendar error:', err)
    return null
  }
}

/** Morgen-Briefing aus Supabase + Kalender — kein Claude-API-Call. */
export async function buildMorningBriefing(dateKey = berlinDateKey()): Promise<BriefingResult> {
  const lines: string[] = []
  const tg: string[] = []

  const title = germanLongDate(dateKey)
  lines.push(`# Briefing — ${title}`, '')
  tg.push(`☀️ *Briefing — ${title}*`, '')

  // ── Schlaf & Erholung ─────────────────────────────────────────────────────
  const sleep = await latestSleep(dateKey)
  const battery = await latestBodyBattery(dateKey)
  const weekAgo = berlinDateKey(-7)

  lines.push('## Schlaf & Erholung')
  tg.push('*Schlaf & Erholung*')

  if (!sleep) {
    lines.push('- Keine Schlafdaten (Garmin-Sync läuft ~05:00 UTC)')
    tg.push('Keine Schlafdaten')
  } else {
    const score = sleep.sleep_score ?? '—'
    const hrv = sleep.hrv_nightly
    let hrvNote = ''
    if (hrv != null) {
      const avg7 = await queryMetric({
        metric: 'hrv',
        from_date: weekAgo,
        to_date: dateKey,
        aggregate: 'avg',
      })
      if (avg7.value != null && avg7.count >= 3) {
        const diff = hrv - avg7.value
        const sign = diff >= 0 ? '+' : ''
        hrvNote = ` (7-Tage-Ø ${Math.round(avg7.value)} ms, ${sign}${Math.round(diff)} ms)`
      }
    }
    lines.push(
      `- Schlaf-Score: **${score}** (${sleep.date})`,
      `- HRV: ${hrv != null ? `${hrv} ms${hrvNote}` : '—'}`,
      `- Schlafdauer: ${sleep.total_sleep_min != null ? fmtDuration(sleep.total_sleep_min) : '—'}`,
    )
    tg.push(
      `Schlaf: ${score} (${sleep.date})`,
      hrv != null ? `HRV: ${hrv} ms${hrvNote}` : '',
    )
    if (battery?.morning_score != null) {
      lines.push(`- Body Battery morgens: ${battery.morning_score}`)
      tg.push(`Body Battery: ${battery.morning_score}`)
    }
    if (sleep.hrv_status) {
      lines.push(`- HRV-Status (Garmin): ${sleep.hrv_status}`)
    }
  }

  const load = await latestTrainingLoad()
  if (load?.acwr != null) {
    const acwr = Math.round(load.acwr * 100) / 100
    const status = load.status_phrase ?? load.acwr_status ?? ''
    lines.push(`- Trainingsbelastung (ACWR): ${acwr}${status ? ` — ${status}` : ''} (${load.date})`)
    tg.push(`ACWR: ${acwr}${status ? ` (${status})` : ''}`)
  }

  lines.push('')
  tg.push('')

  // ── Heute (Kalender) ──────────────────────────────────────────────────────
  const dayStart = new Date(`${dateKey}T00:00:00`)
  const dayEnd = new Date(`${dateKey}T23:59:59.999`)
  let todayEvents: Awaited<ReturnType<typeof fetchCalendarEvents>> = []
  try {
    todayEvents = await fetchCalendarEvents(dayStart, dayEnd)
  } catch (err) {
    console.error('[briefing] calendar error:', err)
  }

  lines.push('## Heute')
  tg.push('*Heute*')

  if (todayEvents.length === 0) {
    lines.push('- Keine Termine im Kalender')
    tg.push('Keine Termine')
  } else {
    for (const ev of todayEvents.slice(0, 8)) {
      const exam = isExamEvent(ev.title)
      const time = ev.allDay ? 'ganztägig' : formatTimeBerlin(ev.start)
      const prefix = exam ? '⚠️ ' : '• '
      lines.push(`- ${prefix}**${time}** — ${ev.title}`)
      tg.push(`${prefix}${time} — ${ev.title}`)
    }
    if (todayEvents.length > 8) {
      lines.push(`- … +${todayEvents.length - 8} weitere`)
    }
  }

  lines.push('')
  tg.push('')

  // ── Training (Woche) ────────────────────────────────────────────────────
  const weekStart = berlinDateKey(-6)
  const { data: weekActs } = await supabaseAdmin
    .from('garmin_activities')
    .select('*')
    .gte('date', weekStart)
    .lte('date', dateKey)
    .order('date', { ascending: false })

  const week = sumTriathlon((weekActs ?? []) as GarminActivity[])
  const yesterday = berlinDateKey(-1)
  const yActs = (weekActs ?? []).filter((a) => a.date === yesterday) as GarminActivity[]

  lines.push('## Training (letzte 7 Tage)')
  tg.push('*Training (7 Tage)*')

  if (week.sessions === 0) {
    lines.push('- Noch keine Garmin-Aktivitäten diese Woche')
    tg.push('Keine Aktivitäten diese Woche')
  } else {
    lines.push(
      `- ${week.sessions} Einheiten · ${week.totalHours} h`,
      `- 🏊 ${week.swimKm} km · 🚴 ${week.bikeKm} km · 🏃 ${week.runKm} km`,
    )
    tg.push(
      `${week.sessions} Einheiten, ${week.totalHours} h`,
      `🏊 ${week.swimKm} · 🚴 ${week.bikeKm} · 🏃 ${week.runKm} km`,
    )
  }

  if (yActs.length > 0) {
    lines.push('', '**Gestern:**')
    tg.push('', 'Gestern:')
    for (const a of yActs) {
      const dist = a.distance_km != null && a.distance_km > 0 ? ` · ${a.distance_km} km` : ''
      const dur = a.duration_min != null ? fmtDuration(a.duration_min) : '?'
      lines.push(`- ${activityLabel(a.type)} ${a.type ?? 'Aktivität'} · ${dur}${dist}`)
      tg.push(`${activityLabel(a.type)} ${a.type} ${dur}${dist}`)
    }
  }

  // ── Nächste geplante Einheit (aus dem Kalender) ──────────────────────────
  const nextTraining = await nextTrainingEvent()
  if (nextTraining) {
    lines.push('', `**Nächste Einheit:** ${nextTraining.title} — ${relativeWhen(nextTraining)}`)
    tg.push('', `Nächste Einheit: ${nextTraining.title} — ${relativeWhen(nextTraining)}`)
  }

  lines.push('')
  tg.push('')

  // ── Heute dran (fällige Aufgaben) ────────────────────────────────────────
  const due = await dueTasks(dateKey)
  if (due.length > 0) {
    lines.push('## Heute dran')
    tg.push('*Heute dran*')
    for (const t of due) {
      lines.push(`- ${t.name}`)
      tg.push(`• ${t.name}`)
    }
    lines.push('')
    tg.push('')
  }

  tg.push('_Dashboard: /_')

  const markdown = lines.join('\n')
  const telegramText = tg.filter(Boolean).join('\n')

  return { dateKey, markdown, telegramText }
}

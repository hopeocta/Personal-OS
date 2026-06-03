import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchCalendarEvents } from '@/lib/calendar'
import { queryMetric } from '@/lib/metrics'
import { isoWeekKey, isoWeekRange, germanLongDate } from '@/lib/berlinDate'
import type { GarminActivity, GarminTraining } from '@/lib/types'

export type WeeklyTrainingResult = {
  weekKey: string
  from: string
  to: string
  markdown: string
  telegramText: string
}

function sumTriathlon(activities: GarminActivity[]) {
  let swimKm = 0
  let bikeKm = 0
  let runKm = 0
  let totalMin = 0
  for (const a of activities) {
    totalMin += a.duration_min ?? 0
    const t = (a.type ?? '').toLowerCase()
    const km = a.distance_km ?? 0
    if (t.includes('swim')) swimKm += km
    else if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) bikeKm += km
    else if (t.includes('run')) runKm += km
  }
  return {
    sessions: activities.length,
    swimKm: Math.round(swimKm * 10) / 10,
    bikeKm: Math.round(bikeKm * 10) / 10,
    runKm: Math.round(runKm * 10) / 10,
    totalHours: Math.round((totalMin / 60) * 10) / 10,
  }
}

const TRAINING_KEYWORDS = [
  'training', 'lauf', 'run', 'rad', 'bike', 'schwimm', 'swim', 'triathlon',
  'kraft', 'gym', 'sport', 'workout', 'einheit',
]

function isTrainingEvent(title: string): boolean {
  const t = title.toLowerCase()
  return TRAINING_KEYWORDS.some((kw) => t.includes(kw))
}

/** Wochen-Training-Zusammenfassung — kein Claude. */
export async function buildWeeklyTrainingSummary(
  weekKey = isoWeekKey(),
): Promise<WeeklyTrainingResult> {
  const { from, to } = isoWeekRange(weekKey)

  const { data: activities } = await supabaseAdmin
    .from('garmin_activities')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  const acts = (activities ?? []) as GarminActivity[]
  const week = sumTriathlon(acts)

  const prevFrom = shiftDate(from, -7)
  const prevTo = shiftDate(to, -7)
  const { data: prevActs } = await supabaseAdmin
    .from('garmin_activities')
    .select('*')
    .gte('date', prevFrom)
    .lte('date', prevTo)
  const prev = sumTriathlon((prevActs ?? []) as GarminActivity[])

  const sleepAvg = await queryMetric({
    metric: 'sleep_score',
    from_date: from,
    to_date: to,
    aggregate: 'avg',
  })

  const { data: loadRow } = await supabaseAdmin
    .from('garmin_training')
    .select('*')
    .lte('date', to)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  const load = loadRow as GarminTraining | null

  const { data: strength } = await supabaseAdmin
    .from('strength_sessions')
    .select('date, intensity')
    .gte('date', from)
    .lte('date', to)

  let plannedTraining = 0
  try {
    const rangeStart = new Date(`${from}T00:00:00`)
    const rangeEnd = new Date(`${to}T23:59:59.999`)
    const events = await fetchCalendarEvents(rangeStart, rangeEnd)
    plannedTraining = events.filter((e) => isTrainingEvent(e.title)).length
  } catch (err) {
    console.error('[weeklyTraining] calendar error:', err)
  }

  const volDelta =
    prev.totalHours > 0
      ? Math.round(((week.totalHours - prev.totalHours) / prev.totalHours) * 100)
      : null

  const lines: string[] = [
    `# Training — Woche ${weekKey}`,
    ``,
    `Zeitraum: ${germanLongDate(from).split(',')[1]?.trim() ?? from} – ${germanLongDate(to).split(',')[1]?.trim() ?? to}`,
    ``,
    `## Absolviert (Garmin)`,
    `- **${week.sessions}** Einheiten · **${week.totalHours} h**`,
    `- 🏊 ${week.swimKm} km · 🚴 ${week.bikeKm} km · 🏃 ${week.runKm} km`,
  ]

  const tg: string[] = [
    `📊 *Training — ${weekKey}*`,
    ``,
    `Garmin: ${week.sessions} Einheiten, ${week.totalHours} h`,
    `🏊 ${week.swimKm} · 🚴 ${week.bikeKm} · 🏃 ${week.runKm} km`,
  ]

  if (volDelta != null) {
    const sign = volDelta >= 0 ? '+' : ''
    lines.push(`- Volumen vs. Vorwoche: ${sign}${volDelta}% (${prev.totalHours} h → ${week.totalHours} h)`)
    tg.push(`Volumen vs. Vorwoche: ${sign}${volDelta}%`)
  }

  if (plannedTraining > 0) {
    const done = week.sessions >= plannedTraining ? '✓' : '○'
    lines.push(`- Kalender: ${week.sessions}/${plannedTraining} trainingstypische Termine ${done}`)
    tg.push(`Kalender: ${week.sessions}/${plannedTraining} Trainingstermine`)
  }

  if ((strength ?? []).length > 0) {
    const avg =
      (strength ?? []).reduce((s, x) => s + (x.intensity ?? 2), 0) / (strength ?? []).length
    lines.push(`- Kraft: ${strength!.length}× (Ø Intensität ${avg.toFixed(1)})`)
    tg.push(`Kraft: ${strength!.length}×`)
  }

  lines.push(``, `## Erholung`)
  if (sleepAvg.value != null && sleepAvg.count > 0) {
    lines.push(`- Schlaf-Score Ø: **${Math.round(sleepAvg.value)}** (${sleepAvg.count} Nächte)`)
    tg.push(`Schlaf Ø: ${Math.round(sleepAvg.value)}`)
  } else {
    lines.push(`- Keine Schlafdaten in dieser Woche`)
    tg.push(`Schlaf: keine Daten`)
  }

  if (load?.acwr != null) {
    const acwr = Math.round(load.acwr * 100) / 100
    lines.push(`- ACWR: ${acwr}${load.status_phrase ? ` (${load.status_phrase})` : ''} — Stand ${load.date}`)
    tg.push(`ACWR: ${acwr}`)
  }

  lines.push(``)
  if (week.sessions === 0) {
    lines.push(`> Keine Garmin-Aktivitäten — Sync prüfen oder Woche war Regeneration.`)
  } else if (volDelta != null && volDelta > 10) {
    lines.push(`> Volumen deutlich über Vorwoche (+${volDelta}%) — Belastung im Blick behalten.`)
  }

  const markdown = lines.join('\n')
  const telegramText = tg.join('\n')

  return { weekKey, from, to, markdown, telegramText }
}

function shiftDate(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

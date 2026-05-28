import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchCalendarEvents, isExamEvent } from '@/lib/calendar'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// Parses the leading number out of a stored avg_pace string like "12.5 km/h".
function parseSpeed(pace: string | null): number | null {
  if (!pace) return null
  const n = parseFloat(pace)
  return isNaN(n) ? null : n
}

// Returns the ISO date of the Monday of the week containing dateStr
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().slice(0, 10)
}

function avg(arr: number[]): number | null {
  if (!arr.length) return null
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const weeks = [4, 8, 12].includes(body.weeks) ? (body.weeks as number) : 8

  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)
  const sinceStr = since.toISOString().slice(0, 10)

  const [sleepRes, activitiesRes, batteryRes, strengthRes, habitsRes, nutritionRes] =
    await Promise.all([
      supabaseAdmin.from('garmin_sleep').select('*').gte('date', sinceStr),
      supabaseAdmin.from('garmin_activities').select('*').gte('date', sinceStr),
      supabaseAdmin.from('garmin_body_battery').select('*').gte('date', sinceStr),
      supabaseAdmin.from('strength_sessions').select('*').gte('date', sinceStr),
      supabaseAdmin.from('daily_habits').select('*').gte('date', sinceStr),
      supabaseAdmin.from('nutrition_logs').select('*').gte('date', sinceStr),
    ])

  if (sleepRes.error) console.error('[analyse] sleep fetch error:', sleepRes.error)
  if (activitiesRes.error) console.error('[analyse] activities fetch error:', activitiesRes.error)
  if (batteryRes.error) console.error('[analyse] battery fetch error:', batteryRes.error)
  if (strengthRes.error) console.error('[analyse] strength fetch error:', strengthRes.error)
  if (habitsRes.error) console.error('[analyse] habits fetch error:', habitsRes.error)
  if (nutritionRes.error) console.error('[analyse] nutrition fetch error:', nutritionRes.error)

  // Sleep aggregation by week
  const sleepByWeek: Record<string, { scores: number[]; hrv: number[]; sleepH: number[]; deepH: number[] }> = {}
  for (const row of sleepRes.data ?? []) {
    const w = getWeekStart(row.date)
    if (!sleepByWeek[w]) sleepByWeek[w] = { scores: [], hrv: [], sleepH: [], deepH: [] }
    if (row.sleep_score != null) sleepByWeek[w].scores.push(row.sleep_score)
    if (row.hrv_nightly != null) sleepByWeek[w].hrv.push(row.hrv_nightly)
    if (row.total_sleep_min != null) sleepByWeek[w].sleepH.push(row.total_sleep_min / 60)
    if (row.deep_sleep_min != null) sleepByWeek[w].deepH.push(row.deep_sleep_min / 60)
  }
  const sleepSummary = Object.entries(sleepByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([w, d]) =>
      `KW ${w}: sleep_score=${avg(d.scores)}, hrv=${avg(d.hrv)}, sleep_h=${avg(d.sleepH)}, deep_h=${avg(d.deepH)}`
    )
    .join('\n') || '(keine Daten)'

  // Activities aggregation by week + type (incl. distance + pace for progress tracking)
  const actByWeekType: Record<
    string,
    { sessions: number; durationH: number[]; hrArr: number[]; distKm: number[]; speed: number[] }
  > = {}
  for (const row of activitiesRes.data ?? []) {
    const key = `${getWeekStart(row.date)}|${row.type ?? 'unbekannt'}`
    if (!actByWeekType[key])
      actByWeekType[key] = { sessions: 0, durationH: [], hrArr: [], distKm: [], speed: [] }
    actByWeekType[key].sessions++
    if (row.duration_min != null) actByWeekType[key].durationH.push(row.duration_min / 60)
    if (row.avg_hr != null) actByWeekType[key].hrArr.push(row.avg_hr)
    if (row.distance_km != null) actByWeekType[key].distKm.push(row.distance_km)
    const sp = parseSpeed(row.avg_pace)
    if (sp != null) actByWeekType[key].speed.push(sp)
  }
  const actSummary = Object.entries(actByWeekType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => {
      const [w, type] = key.split('|')
      const totalKm = round1(d.distKm.reduce((a, b) => a + b, 0))
      return `KW ${w} ${type}: sessions=${d.sessions}, total_h=${round1(d.durationH.reduce((a, b) => a + b, 0))}, total_km=${totalKm}, avg_hr=${avg(d.hrArr)}, avg_tempo_kmh=${avg(d.speed)}`
    })
    .join('\n') || '(keine Daten)'

  // Body battery aggregation by week
  const battByWeek: Record<string, { morning: number[]; stress: number[] }> = {}
  for (const row of batteryRes.data ?? []) {
    const w = getWeekStart(row.date)
    if (!battByWeek[w]) battByWeek[w] = { morning: [], stress: [] }
    if (row.morning_score != null) battByWeek[w].morning.push(row.morning_score)
    if (row.stress_avg != null) battByWeek[w].stress.push(row.stress_avg)
  }
  const batSummary = Object.entries(battByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([w, d]) => `KW ${w}: morning_battery=${avg(d.morning)}, stress=${avg(d.stress)}`)
    .join('\n') || '(keine Daten)'

  // Strength aggregation by week
  const strByWeek: Record<string, { sessions: number; intensities: number[] }> = {}
  for (const row of strengthRes.data ?? []) {
    const w = getWeekStart(row.date)
    if (!strByWeek[w]) strByWeek[w] = { sessions: 0, intensities: [] }
    strByWeek[w].sessions++
    strByWeek[w].intensities.push(row.intensity)
  }
  const strSummary = Object.entries(strByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([w, d]) => `KW ${w}: sessions=${d.sessions}, avg_intensity=${avg(d.intensities)}`)
    .join('\n') || '(keine Daten)'

  // Habits aggregation by week + habit
  const habByWeekName: Record<string, { completed: number; total: number }> = {}
  for (const row of habitsRes.data ?? []) {
    const key = `${getWeekStart(row.date)}|${row.habit_name}`
    if (!habByWeekName[key]) habByWeekName[key] = { completed: 0, total: 0 }
    habByWeekName[key].total++
    if (row.completed) habByWeekName[key].completed++
  }
  const habSummary = Object.entries(habByWeekName)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => {
      const [w, habit] = key.split('|')
      return `KW ${w} ${habit}: ${Math.round((100 * d.completed) / d.total)}%`
    })
    .join('\n') || '(keine Daten)'

  // Nutrition aggregation by week
  const nutByWeek: Record<string, { kcal: number[]; protein: number[]; days: number }> = {}
  for (const row of nutritionRes.data ?? []) {
    const w = getWeekStart(row.date)
    if (!nutByWeek[w]) nutByWeek[w] = { kcal: [], protein: [], days: 0 }
    nutByWeek[w].days++
    if (row.calories != null) nutByWeek[w].kcal.push(row.calories)
    if (row.protein_g != null) nutByWeek[w].protein.push(row.protein_g)
  }
  const nutSummary = Object.entries(nutByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([w, d]) => `KW ${w}: avg_kcal=${avg(d.kcal)}, avg_protein_g=${avg(d.protein)}, logged_days=${d.days}`)
    .join('\n') || '(keine Daten)'

  // Calendar: mark exam weeks within the analysis window so Claude can
  // correlate sleep/stress/training around academic load.
  let examSummary = '(keine Prüfungen im Zeitraum)'
  try {
    const events = await fetchCalendarEvents(since, new Date())
    const exams = events.filter((e) => isExamEvent(e.title))
    if (exams.length) {
      examSummary = exams
        .map((e) => {
          const date = e.start.slice(0, 10)
          return `KW ${getWeekStart(date)} (${date}): ${e.title}`
        })
        .join('\n')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[analyse] calendar fetch error:', msg)
    examSummary = '(Kalender nicht erreichbar)'
  }

  const dataBlock = `=== ANALYSEDATEN (${weeks} Wochen ab ${sinceStr}) ===

SCHLAF (wöchentliche Durchschnitte):
${sleepSummary}

AKTIVITÄTEN (wöchentlich nach Typ):
${actSummary}

BODY BATTERY & STRESS:
${batSummary}

KRAFTTRAINING:
${strSummary}

GEWOHNHEITEN (Erfüllungsrate):
${habSummary}

ERNÄHRUNG:
${nutSummary}

PRÜFUNGSWOCHEN (akademische Belastung — korreliere Schlaf/Stress/Training um diese Wochen):
${examSummary}`

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 3072,
          system: `Du bist ein persönlicher Performance-Analyst. Analysiere die Daten des Nutzers und finde echte Muster und Korrelationen. Sei konkret und datenbasiert.

Achte besonders auf:
- Trainingsfortschritt über die Zeit: entwickelt sich Tempo (avg_tempo_kmh), Distanz (total_km) und Herzfrequenz pro Sportart in die richtige Richtung? Wird der Nutzer schneller bei gleichem oder niedrigerem Puls?
- Erholung: Zusammenhang zwischen Schlaf (Score, HRV, Tiefschlaf), Body Battery, Stress und Trainingsleistung.
- Krafttraining: wie passt Intensität/Häufigkeit zu Erholung und Ausdauerleistung?
- Prüfungswochen: wie verändern sich Schlaf, Stress, Body Battery und Trainingsvolumen in und um Wochen mit Prüfungen? Benenne konkrete Effekte.

Formatiere als Markdown mit diesen Abschnitten: ## Schlaf & Erholung, ## Training & Fortschritt, ## Stress & Belastung (inkl. Prüfungen), ## Ernährung & Korrelationen, ## Empfehlungen. Antworte auf Deutsch.`,
          messages: [{ role: 'user', content: dataBlock }],
        })

        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const chunk = event.delta.text
            fullText += chunk
            controller.enqueue(encoder.encode(chunk))
          }
        }

        // Save analysis as knowledge entry (background, non-blocking)
        void supabaseAdmin
          .from('knowledge_entries')
          .insert({
            raw_text: `Korrelationsanalyse ${weeks} Wochen (${sinceStr} bis heute):\n\n${fullText}`,
            category: 'Allgemein',
            summary: `Korrelationsanalyse ${weeks} Wochen — ${new Date().toLocaleDateString('de-DE')}`,
            tags: ['analyse', 'korrelation'],
            source: 'analyse',
            user_id: 'me',
          })
          .then(({ error }) => {
            if (error) console.error('[analyse] save knowledge error:', error)
          })

        controller.close()
      } catch (err) {
        console.error('[analyse] stream error:', err)
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

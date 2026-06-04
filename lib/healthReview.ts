import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabaseAdmin'
import { appendToDailyLog, berlinNow, writeObsidianNote } from './obsidian'
import type { GarminActivity, GarminSleep, GarminBodyBattery, GarminTraining, HealthLab } from './types'

const anthropic = new Anthropic()

export type ReviewPeriod = 'monthly' | 'halfyear' | 'annual'

function periodLabel(period: ReviewPeriod, from: string, to: string): string {
  if (period === 'monthly') {
    const d = new Date(from)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  if (period === 'halfyear') return `${from.slice(0, 7)} bis ${to.slice(0, 7)} (6 Monate)`
  return `${from.slice(0, 4)} (12 Monate)`
}

function periodDates(period: ReviewPeriod): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  let from: string
  if (period === 'monthly') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    from = d.toISOString().slice(0, 10)
  } else if (period === 'halfyear') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 6)
    from = d.toISOString().slice(0, 10)
  } else {
    const d = new Date(now)
    d.setFullYear(d.getFullYear() - 1)
    from = d.toISOString().slice(0, 10)
  }
  return { from, to }
}

// ── Daten sammeln ──────────────────────────────────────────────────

async function fetchActivities(from: string, to: string): Promise<GarminActivity[]> {
  const { data } = await supabaseAdmin
    .from('garmin_activities')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
  return (data ?? []) as GarminActivity[]
}

async function fetchSleep(from: string, to: string): Promise<GarminSleep[]> {
  const { data } = await supabaseAdmin
    .from('garmin_sleep')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
  return (data ?? []) as GarminSleep[]
}

async function fetchBodyBattery(from: string, to: string): Promise<GarminBodyBattery[]> {
  const { data } = await supabaseAdmin
    .from('garmin_body_battery')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
  return (data ?? []) as GarminBodyBattery[]
}

async function fetchTraining(from: string, to: string): Promise<GarminTraining[]> {
  const { data } = await supabaseAdmin
    .from('garmin_training')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
  return (data ?? []) as GarminTraining[]
}

async function fetchLabs(from: string, to: string): Promise<HealthLab[]> {
  const { data } = await supabaseAdmin
    .from('health_labs')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
  return (data ?? []) as HealthLab[]
}

// ── Wissenschaftliche Kennzahlen berechnen ────────────────────────────────

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function parseAvgPaceSec(pace: string | null): number | null {
  if (!pace) return null
  const parts = pace.split(':')
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  return null
}

function secondsToPace(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')} min/km`
}

// Herzfrequenz-Zonen nach Karvonen (basierend auf Resting HR aus Schlaf-Daten)
// Zone 1: <60% HRR, Zone 2: 60-70%, Zone 3: 70-80%, Zone 4: 80-90%, Zone 5: >90%
function classifyHRZone(avgHr: number, restingHr: number, maxHr: number): 1 | 2 | 3 | 4 | 5 {
  const hrr = maxHr - restingHr
  const pct = (avgHr - restingHr) / hrr
  if (pct < 0.6) return 1
  if (pct < 0.7) return 2
  if (pct < 0.8) return 3
  if (pct < 0.9) return 4
  return 5
}

interface ActivityStats {
  totalSessions: number
  totalHours: number
  swimKm: number
  bikeKm: number
  runKm: number
  // HR-Zonen-Verteilung (% der Einheiten)
  zoneDistribution: Record<1 | 2 | 3 | 4 | 5, number>
  // Polarisierungs-Index: Zone 1+2 vs Zone 4+5 (wissenschaftlich empfohlen: >80% Z1-2)
  polarizationIndex: { lowPct: number; highPct: number; midPct: number } | null
  // HR-zu-Pace Effizienz (nur Laufen)
  runEfficiency: { avgHrPerKmh: number | null; trend: 'improving' | 'stable' | 'declining' | null }
  // Trainings-Intensitätsverteilung nach Einheitstyp
  byType: Record<string, { sessions: number; hours: number; avgHr: number | null }>
  // ACWR-Verlauf
  acwrValues: { date: string; acwr: number }[]
  avgAcwr: number | null
  vo2maxLatest: number | null
}

function computeActivityStats(
  activities: GarminActivity[],
  sleepData: GarminSleep[],
  trainingData: GarminTraining[],
): ActivityStats {
  // Resting HR Durchschnitt für Karvonen
  const restingHrs = sleepData.map((s) => s.resting_hr).filter((v): v is number => v != null)
  const avgRestingHr = avg(restingHrs) ?? 50
  const maxHr = 185 // Standard Triathlet ~35 Jahre; TODO: aus Profil lesen

  const zoneCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const byType: ActivityStats['byType'] = {}

  let swimKm = 0, bikeKm = 0, runKm = 0, totalMin = 0
  const runSessions: { avgHr: number; speedKmh: number }[] = []

  for (const a of activities) {
    totalMin += a.duration_min ?? 0
    const t = (a.type ?? 'other').toLowerCase()
    const km = a.distance_km ?? 0

    if (t.includes('swim')) swimKm += km
    else if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) bikeKm += km
    else if (t.includes('run')) runKm += km

    // HR-Zone klassifizieren
    if (a.avg_hr != null) {
      const zone = classifyHRZone(a.avg_hr, avgRestingHr, maxHr)
      zoneCounts[zone]++

      // Lauf-Effizienz: HR pro km/h
      if (t.includes('run') && a.duration_min != null && km > 0) {
        const speedKmh = km / (a.duration_min / 60)
        runSessions.push({ avgHr: a.avg_hr, speedKmh })
      }
    }

    // Nach Typ gruppieren
    const typeKey = t.includes('swim') ? 'Schwimmen'
      : t.includes('cycl') || t.includes('bike') ? 'Radfahren'
      : t.includes('run') ? 'Laufen'
      : t.includes('strength') || t.includes('gym') ? 'Kraft'
      : 'Sonstiges'
    if (!byType[typeKey]) byType[typeKey] = { sessions: 0, hours: 0, avgHr: null }
    byType[typeKey].sessions++
    byType[typeKey].hours += (a.duration_min ?? 0) / 60
    if (a.avg_hr != null) {
      const cur = byType[typeKey].avgHr
      byType[typeKey].avgHr = cur == null ? a.avg_hr : (cur + a.avg_hr) / 2
    }
  }

  const total = activities.length
  const zoneDistribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: total > 0 ? Math.round((zoneCounts[1] / total) * 100) : 0,
    2: total > 0 ? Math.round((zoneCounts[2] / total) * 100) : 0,
    3: total > 0 ? Math.round((zoneCounts[3] / total) * 100) : 0,
    4: total > 0 ? Math.round((zoneCounts[4] / total) * 100) : 0,
    5: total > 0 ? Math.round((zoneCounts[5] / total) * 100) : 0,
  }

  // Polarisierungs-Index
  const lowPct = zoneDistribution[1] + zoneDistribution[2]
  const midPct = zoneDistribution[3]
  const highPct = zoneDistribution[4] + zoneDistribution[5]
  const polarizationIndex = total > 0 ? { lowPct, midPct, highPct } : null

  // Run-Effizienz-Trend (erste Hälfte vs zweite Hälfte des Zeitraums)
  let runEfficiency: ActivityStats['runEfficiency'] = { avgHrPerKmh: null, trend: null }
  if (runSessions.length >= 4) {
    const mid = Math.floor(runSessions.length / 2)
    const firstHalf = avg(runSessions.slice(0, mid).map((r) => r.avgHr / r.speedKmh))
    const secondHalf = avg(runSessions.slice(mid).map((r) => r.avgHr / r.speedKmh))
    const overall = avg(runSessions.map((r) => r.avgHr / r.speedKmh))
    runEfficiency.avgHrPerKmh = overall ? Math.round(overall * 10) / 10 : null
    if (firstHalf != null && secondHalf != null) {
      const diff = secondHalf - firstHalf
      // Niedrigerer Wert = effizienter (weniger HR pro km/h)
      runEfficiency.trend = diff < -1 ? 'improving' : diff > 1 ? 'declining' : 'stable'
    }
  }

  // ACWR-Verlauf
  const acwrValues = trainingData
    .filter((t) => t.acwr != null)
    .map((t) => ({ date: t.date, acwr: t.acwr! }))
  const avgAcwr = avg(acwrValues.map((v) => v.acwr))
  const vo2maxLatest = trainingData.filter((t) => t.vo2max != null).slice(-1)[0]?.vo2max ?? null

  return {
    totalSessions: total,
    totalHours: Math.round((totalMin / 60) * 10) / 10,
    swimKm: Math.round(swimKm * 10) / 10,
    bikeKm: Math.round(bikeKm * 10) / 10,
    runKm: Math.round(runKm * 10) / 10,
    zoneDistribution,
    polarizationIndex,
    runEfficiency,
    byType,
    acwrValues,
    avgAcwr: avgAcwr ? Math.round(avgAcwr * 100) / 100 : null,
    vo2maxLatest,
  }
}

interface SleepStats {
  avgScore: number | null
  avgDurationMin: number | null
  avgHrvNightly: number | null
  avgRestingHr: number | null
  avgDeepPct: number | null   // % Tiefschlaf (wissenschaftl. Norm: 15-25%)
  avgRemPct: number | null    // % REM (Norm: 20-25%)
  hrvTrend: 'improving' | 'stable' | 'declining' | null
  nightsWithData: number
  stressAvg: number | null
  bodyBatteryAvg: number | null
}

function computeSleepStats(sleepData: GarminSleep[], batteryData: GarminBodyBattery[]): SleepStats {
  const scores = sleepData.map((s) => s.sleep_score).filter((v): v is number => v != null)
  const durations = sleepData.map((s) => s.total_sleep_min).filter((v): v is number => v != null)
  const hrvsNightly = sleepData.map((s) => s.hrv_nightly).filter((v): v is number => v != null)
  const restingHrs = sleepData.map((s) => s.resting_hr).filter((v): v is number => v != null)

  // Schlafphasen als % der Gesamtschlafzeit
  const deepPcts = sleepData
    .filter((s) => s.total_sleep_min != null && s.deep_sleep_min != null && s.total_sleep_min > 0)
    .map((s) => (s.deep_sleep_min! / s.total_sleep_min!) * 100)
  const remPcts = sleepData
    .filter((s) => s.total_sleep_min != null && s.rem_sleep_min != null && s.total_sleep_min > 0)
    .map((s) => (s.rem_sleep_min! / s.total_sleep_min!) * 100)

  // HRV-Trend: erste vs zweite Hälfte
  let hrvTrend: SleepStats['hrvTrend'] = null
  if (hrvsNightly.length >= 6) {
    const mid = Math.floor(hrvsNightly.length / 2)
    const first = avg(hrvsNightly.slice(0, mid))
    const second = avg(hrvsNightly.slice(mid))
    if (first != null && second != null) {
      const diff = second - first
      hrvTrend = diff > 2 ? 'improving' : diff < -2 ? 'declining' : 'stable'
    }
  }

  const stressVals = batteryData.map((b) => b.stress_avg).filter((v): v is number => v != null)
  const batteryVals = batteryData.map((b) => b.morning_score).filter((v): v is number => v != null)

  return {
    avgScore: avg(scores) ? Math.round(avg(scores)!) : null,
    avgDurationMin: avg(durations) ? Math.round(avg(durations)!) : null,
    avgHrvNightly: avg(hrvsNightly) ? Math.round(avg(hrvsNightly)!) : null,
    avgRestingHr: avg(restingHrs) ? Math.round(avg(restingHrs)!) : null,
    avgDeepPct: avg(deepPcts) ? Math.round(avg(deepPcts)!) : null,
    avgRemPct: avg(remPcts) ? Math.round(avg(remPcts)!) : null,
    hrvTrend,
    nightsWithData: scores.length,
    stressAvg: avg(stressVals) ? Math.round(avg(stressVals)!) : null,
    bodyBatteryAvg: avg(batteryVals) ? Math.round(avg(batteryVals)!) : null,
  }
}

// ── Claude Analyse ───────────────────────────────────────────────────────

function buildSystemPrompt(period: ReviewPeriod): string {
  const periodText = period === 'monthly' ? 'einen Monat' : period === 'halfyear' ? '6 Monate' : '12 Monate'
  return `Du bist ein Sportwissenschaftler und Schlaf-/Gesundheitsanalyst der einen persönlichen Trainings- und Gesundheitsbericht für einen ambitionierten Triathleten (Hobbyathlet, ca. 35 Jahre) erstellt.

Zeitraum: ${periodText}

Du analysierst die Daten nach offiziellen sportwissenschaftlichen Standards:

## Trainingsanalyse-Framework
- **Polarisiertes Training (80/20-Regel)**: >80% Zone 1-2 (GA1), <20% Zone 4-5 (EB/SB). Zone 3 (Übergangsbereich) gilt als suboptimal.
- **ACWR (Acute:Chronic Workload Ratio)**: Optimaler Bereich 0.8-1.3. <0.8 = Untertraining. >1.5 = erhöhtes Verletzungsrisiko (Gabbett 2016).
- **HR:Pace-Effizienz**: Sinkende HR bei gleicher Pace = Fitness-Fortschritt (Aerobic Efficiency Index).
- **ATL/CTL**: Acute Training Load vs Chronic Training Load. CTL-Aufbau: max. +5 TSS/Woche empfohlen.
- **VO2max-Entwicklung**: Garmin-Schätzwert als Trendindikator (nicht absolut).

## Schlafanalyse-Framework
- **Schlafdauer**: Leistungssportler: 8-10h empfohlen (Walker 2017, Grandner 2019). <7h = Regenerations-Risiko.
- **Tiefschlaf**: Norm 15-25% der Gesamtschlafzeit. Wichtig für körperliche Regeneration und GH-Ausschüttung.
- **REM-Schlaf**: Norm 20-25%. Wichtig für kognitive Leistung und emotionale Regulation.
- **HRV (nächtlich)**: Höher = bessere vegetative Balance. Trend wichtiger als Absolut-Wert. Sinkende HRV bei hohem Volumen = Übertraining-Signal.
- **Resting HR**: Erhöhung >5 bpm über Baseline = Erholungsdefizit oder Krankheits-Signal.
- **Stress-Score**: Garmin-Stressmessung via HRV-Variabilität. Dauerhaft >50 = Interventionsbedarf.

## Gesundheits-Biomarker (falls vorhanden)
- Ferritin: Norm Athleten Männer 50-200 ng/ml; <30 = Leistungseinschränkung möglich
- Hämoglobin: Norm 13.5-17.5 g/dl
- Vitamin D: Sportler-Ziel 40-60 ng/ml
- Laktat-Kurve: LT1/LT2-Schwellen aus Laktattest wenn vorhanden

## Format des Berichts (Markdown)
Strukturiere mit diesen Abschnitten:
1. Executive Summary (3-5 Sätze: wichtigste Erkenntnisse)
2. Training (Volumen, Intensitätsverteilung, Effizienz, ACWR-Verlauf)
3. Schlaf & Erholung (Score, Schlafphasen, HRV-Trend, Stress)
4. Gesundheit (Laborwerte falls vorhanden, Trends)
5. Korrelationen (z.B. Training ↔ HRV, Stress ↔ Schlaf)
6. Empfehlungen (konkret, evidenzbasiert, 3-5 Punkte)

Sprache: Deutsch. Fachlich aber verständlich. Nutze Zahlen und Trends, keine Floskeln.`
}

function buildDataContext(
  period: ReviewPeriod,
  from: string,
  to: string,
  acts: ActivityStats,
  sleep: SleepStats,
  labs: HealthLab[],
): string {
  const lines: string[] = [
    `## Zeitraum: ${from} bis ${to}`,
    '',
    '### Training',
    `- Einheiten gesamt: ${acts.totalSessions}`,
    `- Trainingszeit gesamt: ${acts.totalHours} h`,
    `- Volumen: Schwimmen ${acts.swimKm} km | Radfahren ${acts.bikeKm} km | Laufen ${acts.runKm} km`,
    '',
    '**Intensitätsverteilung (HR-Zonen nach Karvonen):**',
    `- Zone 1: ${acts.zoneDistribution[1]}%`,
    `- Zone 2: ${acts.zoneDistribution[2]}%`,
    `- Zone 3: ${acts.zoneDistribution[3]}% (Grauzone)`,
    `- Zone 4: ${acts.zoneDistribution[4]}%`,
    `- Zone 5: ${acts.zoneDistribution[5]}%`,
  ]

  if (acts.polarizationIndex) {
    const { lowPct, midPct, highPct } = acts.polarizationIndex
    lines.push(
      `- Polarisierungs-Index: ${lowPct}% Zone 1-2 | ${midPct}% Zone 3 | ${highPct}% Zone 4-5`,
      `- 80/20-Regel eingehalten: ${lowPct >= 75 ? 'JA ✓' : lowPct >= 65 ? 'TEILWEISE' : 'NEIN ⚠'}`,
    )
  }

  lines.push('', '**Nach Sportart:**')
  for (const [type, stats] of Object.entries(acts.byType)) {
    lines.push(
      `- ${type}: ${stats.sessions} Einheiten, ${Math.round(stats.hours * 10) / 10} h` +
      (stats.avgHr ? `, Ø HR: ${Math.round(stats.avgHr)} bpm` : ''),
    )
  }

  if (acts.runEfficiency.avgHrPerKmh != null) {
    lines.push(
      '',
      `**Lauf-Effizienz (HR/Geschwindigkeit-Index):** ${acts.runEfficiency.avgHrPerKmh} bpm/(km/h)`,
      `- Trend: ${acts.runEfficiency.trend === 'improving' ? '↗ Verbesserung (aerobe Effizienz steigt)' : acts.runEfficiency.trend === 'declining' ? '↘ Abnahme' : '→ Stabil'}`,
    )
  }

  if (acts.avgAcwr != null) {
    lines.push(
      '',
      `**ACWR-Verlauf:**`,
      `- Durchschnitt: ${acts.avgAcwr} (Norm: 0.8-1.3)`,
    )
    // ACWR-Spitzenwerte
    const peaks = acts.acwrValues.filter((v) => v.acwr > 1.4)
    if (peaks.length > 0) {
      lines.push(`- Risiko-Perioden (ACWR >1.4): ${peaks.map((p) => `${p.date}: ${p.acwr}`).join(', ')}`)
    }
  }

  if (acts.vo2maxLatest != null) {
    lines.push(`- VO2max (Garmin-Schätzwert, aktuell): ${acts.vo2maxLatest} ml/(kg·min)`)
  }

  lines.push(
    '',
    '### Schlaf & Erholung',
    `- Auswertbare Nächte: ${sleep.nightsWithData}`,
    `- Schlaf-Score Ø: ${sleep.avgScore ?? '—'}`,
    `- Schlafdauer Ø: ${sleep.avgDurationMin != null ? `${Math.floor(sleep.avgDurationMin / 60)}h ${sleep.avgDurationMin % 60}min` : '—'}`,
    `- HRV nächtlich Ø: ${sleep.avgHrvNightly ?? '—'} ms`,
    `- HRV-Trend: ${sleep.hrvTrend ?? 'zu wenig Daten'}`,
    `- Resting HR Ø: ${sleep.avgRestingHr ?? '—'} bpm`,
    `- Tiefschlaf-Anteil Ø: ${sleep.avgDeepPct ?? '—'}% (Norm: 15-25%)`,
    `- REM-Anteil Ø: ${sleep.avgRemPct ?? '—'}% (Norm: 20-25%)`,
    `- Stress-Score Ø: ${sleep.stressAvg ?? '—'} (Norm: <50)`,
    `- Body Battery morgens Ø: ${sleep.bodyBatteryAvg ?? '—'}`,
  )

  if (labs.length > 0) {
    lines.push('', '### Laborwerte')
    // Gruppiert nach Test-Name, neuester Wert
    const byTest = new Map<string, HealthLab>()
    for (const lab of labs) {
      byTest.set(lab.test_name, lab)
    }
    for (const [name, lab] of byTest.entries()) {
      const ref = lab.reference_min != null || lab.reference_max != null
        ? ` (Norm: ${lab.reference_min ?? ''}-${lab.reference_max ?? ''} ${lab.unit ?? ''})` : ''
      lines.push(`- ${name}: ${lab.value ?? '—'} ${lab.unit ?? ''} [${lab.status}]${ref} (${lab.date})`)
    }
  }

  return lines.join('\n')
}

// ── Obsidian speichern ─────────────────────────────────────────────────────

async function saveToObsidian(period: ReviewPeriod, label: string, content: string): Promise<boolean> {
  const folder = period === 'monthly'
    ? 'Monatsberichte'
    : period === 'halfyear'
    ? 'Halbjährig'
    : 'Jahresberichte'
  const fileName = `${label}.md`
  const frontmatter = `---
type: health-review
period: ${period}
generated: ${new Date().toISOString().slice(0, 10)}
---

`
  return writeObsidianNote(`Gesundheit & Training/${folder}/${fileName}`, frontmatter + content)
}

// ── Haupt-Export ────────────────────────────────────────────────────────────

export async function runHealthReview(period: ReviewPeriod): Promise<string> {
  const { from, to } = periodDates(period)
  const label = periodLabel(period, from, to)

  const [activities, sleepData, batteryData, trainingData, labs] = await Promise.all([
    fetchActivities(from, to),
    fetchSleep(from, to),
    fetchBodyBattery(from, to),
    fetchTraining(from, to),
    fetchLabs(from, to),
  ])

  if (activities.length === 0 && sleepData.length === 0) {
    return `⚠️ Keine Garmin-Daten für ${label} gefunden.`
  }

  const actStats = computeActivityStats(activities, sleepData, trainingData)
  const sleepStats = computeSleepStats(sleepData, batteryData)
  const dataContext = buildDataContext(period, from, to, actStats, sleepStats, labs)

  // Modell je nach Komplexität
  const model = period === 'monthly' ? 'claude-sonnet-4-6' : 'claude-opus-4-8'

  const message = await anthropic.messages.create({
    model,
    max_tokens: period === 'monthly' ? 2000 : 4000,
    system: buildSystemPrompt(period),
    messages: [{ role: 'user', content: dataContext }],
  })

  const review = message.content[0].type === 'text' ? message.content[0].text : ''
  const fullReport = `# Gesundheits- & Trainingsanalyse — ${label}\n\n${review}\n\n---\n*Generiert am ${new Date().toISOString().slice(0, 10)} | Daten: ${from} bis ${to} | ${activities.length} Aktivitäten, ${sleepData.length} Nächte*`

  // In Obsidian speichern
  const obsidianOk = await saveToObsidian(period, label, fullReport)

  // In knowledge_entries für RAG
  await supabaseAdmin.from('knowledge_entries').insert({
    user_id: 'me',
    raw_text: fullReport,
    summary: `Gesundheits- & Trainingsanalyse ${label}`,
    category: 'Gesundheit',
    source: `health_review_${period}`,
    tags: ['training', 'schlaf', 'gesundheit', period, label],
  })

  // Daily Log
  const { dateKey, timeBerlin } = berlinNow()
  void appendToDailyLog({
    kind: 'note',
    timeBerlin,
    dateKey,
    content: `Gesundheitsanalyse (${period}) generiert → Obsidian: Gesundheit & Training/${period === 'monthly' ? 'Monatsberichte' : period === 'halfyear' ? 'Halbjährig' : 'Jahresberichte'}/${label}.md`,
  })

  const obsNote = obsidianOk ? '' : '\n⚠️ Obsidian nicht erreichbar — in Supabase gespeichert.'
  return `📊 *Analyse ${label} fertig*\n\nIn Obsidian: Gesundheit & Training/${period === 'monthly' ? 'Monatsberichte' : period === 'halfyear' ? 'Halbjährig' : 'Jahresberichte'}/${label}.md${obsNote}`
}

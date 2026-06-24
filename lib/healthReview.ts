import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabaseAdmin'
import { appendToDailyLog, berlinNow, writeObsidianFile } from './obsidian'
import { fetchCalendarEvents, isExamEvent } from './calendar'
import type { GarminActivity, GarminSleep, GarminBodyBattery, GarminTraining, HealthLab, NutritionLog, DailyHabit } from './types'

const anthropic = new Anthropic()

export type ReviewPeriod = 'monthly' | 'halfyear' | 'annual'

// ── Analyse-Parameter aus Obsidian laden (editierbar!) ─────────────────────

const PARAMS_VAULT_PATH = 'Gesundheit/Training/analyse-parameter.md'

async function loadAnalysisParams(): Promise<string> {
  const url = process.env.OBSIDIAN_API_URL
  const key = process.env.OBSIDIAN_API_KEY
  if (!url || !key) return getDefaultParams()
  const encoded = PARAMS_VAULT_PATH.split('/').map(encodeURIComponent).join('/')
  try {
    const res = await fetch(`${url}/vault/${encoded}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return getDefaultParams()
    return await res.text()
  } catch {
    return getDefaultParams()
  }
}

function getDefaultParams(): string {
  return `# Analyse-Parameter: Gesundheit/Training

> Diese Datei steuert wie die automatischen Monats-, Halbjahres- und Jahresanalysen erstellt werden.
> Änderungen hier wirken sich direkt auf die nächste Analyse aus — kein Code-Änderung nötig.

---

## 🏃 Trainingsprofil

- **Sportart**: Triathlon (Schwimmen, Radfahren, Laufen)
- **Niveau**: Hobbyathlet, ambitioniert
- **Alter**: 35 Jahre
- **Maximale Herzfrequenz**: 185 bpm (manuell gemessen oder Garmin-Schätzwert)
- **Trainingsziel**: Ausdauer verbessern, Ironman-Vorbereitung
- **Wettkampfsaison**: April – Oktober

---

## 📏 Trainings-Kennzahlen & Normen

### Herzfrequenz-Zonen (Karvonen-Methode)
Berechnungsgrundlage: (HFmax - HFRuhe) × Intensität% + HFRuhe

| Zone | Intensität | Bezeichnung | Trainingswirkung |
|---|---|---|---|
| Zone 1 | <60% HFR | Regeneration (REKOM) | Aktive Erholung, Fettverbrennung |
| Zone 2 | 60-70% HFR | Grundlage 1 (GA1) | Aerobe Basis, Mitochondrien-Aufbau |
| Zone 3 | 70-80% HFR | Grundlage 2 / Übergang | Grauzone — vermeiden |
| Zone 4 | 80-90% HFR | Entwicklung (EB) | Laktatschwelle, VO2max-Stimulus |
| Zone 5 | >90% HFR | Spitzenbereich (SB) | Neuromuskulaer, max. Leistung |

### Polarisiertes Training (80/20-Regel)
- **Ziel**: >80% Zone 1-2 (GA1/REKOM) + <20% Zone 4-5
- **Zone 3 Warnschwelle**: >15% der Einheiten = suboptimale Intensitätsverteilung
- **Quelle**: Seiler & Kjerland (2006), Stoggl & Sperlich (2014)

### ACWR – Acute:Chronic Workload Ratio
- **Optimaler Bereich**: 0.8 – 1.3
- **Untertraining**: <0.8
- **Erhöhtes Verletzungsrisiko**: >1.3 (Vorsicht), >1.5 (kritisch)
- **CTL-Aufbau**: max. +5 TSS/Woche empfohlen
- **Quelle**: Gabbett (2016), Hulin et al. (2016)

### VO2max (Garmin-Schätzwert)
- Nicht absolut verwenden, nur als Trendindikator
- Altersabhängige Norm Männer 35J: 46-52 ml/(kg·min) = überdurchschnittlich
- Quelle: Garmin FirstBeat Methodik

### Lauf-Effizienz (Aerobic Efficiency Index)
- Kennzahl: durchschnittliche HR geteilt durch Geschwindigkeit (bpm / km/h)
- Sinkender Wert über Zeit = aerobe Effizienz steigt = Fitnessfortschritt
- Trend: erste Hälfte vs zweite Hälfte des Analysezeitraums

---

## 💤 Schlaf & Erholung

### Schlafdauer
- **Norm Ausdauersportler**: 8-10h pro Nacht (Walker 2017, Grandner 2019)
- **Risikoschwelle**: <7h → Regenerationsdefizit, Leistungseinbußen
- **Kritisch**: <6h → erhöhtes Verletzungsrisiko, Immunsuppression

### Schlafphasen
| Phase | Norm | Funktion |
|---|---|---|
| Tiefschlaf | 15-25% | Körperliche Regeneration, Wachstumshormon-Ausschüttung |
| REM | 20-25% | Kognition, Gedächtniskonsolidierung, emotionale Regulation |
| Leichtschlaf | 45-55% | Übergangsphase |

### HRV (nächtliche Herzratenvariabilität)
- **Trend wichtiger als Absolutwert** (individuell sehr verschieden)
- Sinkende HRV bei hohem Trainingsvolumen = Übertraining-Signal
- Erhöhung um >2 ms im Zeitverlauf = positive Adaptation
- Garmin HRV-Status: "Balanced" = Ziel

### Resting HR
- Erhöhung >5 bpm über persönliche Baseline = Erholungsdefizit oder Krankheitssignal
- Sinkende RHR über Monate = Fitnessfortschritt

### Stress-Score (Garmin)
- <25: Niedrig (gut)
- 25-50: Mittel (normal)
- 50-75: Hoch (beobachten)
- >75: Sehr hoch (Interventionsbedarf)
- Basis: HRV-Variabilität tagsüber

### Body Battery
- Morgendlicher Wert: Ziel >70
- <50 morgens = unvollständige Regeneration

---

## 🩸 Gesundheits-Biomarker

| Wert | Norm allgemein | Norm Ausdauersportler | Quelle |
|---|---|---|---|
| Ferritin (M) | 30-400 ng/ml | 50-200 ng/ml | Schobersberger 2020 |
| Hämoglobin (M) | 13.5-17.5 g/dl | 14-18 g/dl | WHO |
| Vitamin D (25-OH) | 20-50 ng/ml | 40-60 ng/ml | Endokrinologie |
| Magnesium | 0.7-1.0 mmol/l | 0.8-1.1 mmol/l | DGE |
| CRP | <5 mg/l | <3 mg/l | Klinisch |
| Kreatinkinase (CK) | 30-170 U/l | bis 400 U/l post-Training | Sportmedizin |
| Laktat LT1 | individuell | ~2 mmol/l | Hollmann & Hettinger |
| Laktat LT2 | individuell | ~4 mmol/l | Mader-Modell |

---

## 🔄 Korrelationen die analysiert werden

1. **Trainingsvolumen ↔ HRV**: Höheres Volumen = sinkende HRV erwartbar. Wenn HRV sinkt OHNE Volumensteigerung: Übertraining-Signal.
2. **ACWR ↔ Schlaf-Score**: Hohe Last-Perioden sollten mit besserem Schlaf kompensiert werden.
3. **Stress-Score ↔ Schlafqualität**: Dauerhaft hoher Stress korreliert mit schlechterem REM-Anteil.
4. **Resting HR-Trend ↔ Fitness**: Langfristig sinkende RHR = aerobe Adaptation.
5. **Lauf-Effizienz ↔ Trainingsvolumen**: Effizienzgewinn bei stetigem aeroben Volumen erwartet.
6. **Ferritin/Hämoglobin ↔ Ausdauerleistung**: Eisenmangel limitiert VO2max direkt.
7. **Trainingsintensität ↔ nächste-Nacht-HRV**: High-Intensity-Session sollte folgende HRV messbar senken (Validierung der Zonenklassifikation).

---

## 📊 Empfehlungs-Framework

Die Analyse soll konkrete, evidenzbasierte Empfehlungen geben:

- **Format**: "Beobachtung → Mechanismus → Empfehlung (Quelle)"
- **Beispiel**: "Dein Zone-3-Anteil ist 28% (Norm: <15%). Das ist die sogenannte Grauzone: zu intensiv für optimale aerobe Anpassung, zu locker für VO2max-Stimulus (Seiler 2010). → Mehr Einheiten wirklich leicht fahren/laufen (Zone 2, Nasenatemtest)."
- **Priorisierung**: Max. 5 Empfehlungen, nach Relevanz sortiert
- **Keine Floskeln**: Keine allgemeinen Tipps ohne direkten Bezug zu deinen Daten
`
}

async function ensureParamsFileExists(): Promise<void> {
  const url = process.env.OBSIDIAN_API_URL
  const key = process.env.OBSIDIAN_API_KEY
  if (!url || !key) return
  const encoded = PARAMS_VAULT_PATH.split('/').map(encodeURIComponent).join('/')
  try {
    const res = await fetch(`${url}/vault/${encoded}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.status === 404) {
      // Datei existiert noch nicht — erstellen
      await writeObsidianFile(PARAMS_VAULT_PATH, getDefaultParams())
      console.log('[healthReview] analyse-parameter.md erstellt in Obsidian')
    }
  } catch (err) {
    console.error('[healthReview] ensureParamsFileExists error:', err)
  }
}

// ── Zeitraum-Helpers ───────────────────────────────────────────────────

function periodLabel(period: ReviewPeriod, from: string, to: string): string {
  if (period === 'monthly') {
    const d = new Date(from)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  if (period === 'halfyear') return `${from.slice(0, 7)} bis ${to.slice(0, 7)}`
  return `${from.slice(0, 4)}`
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
  const { data } = await supabaseAdmin.from('garmin_activities').select('*').eq('user_id', 'me').gte('date', from).lte('date', to).order('date', { ascending: true })
  return (data ?? []) as GarminActivity[]
}
async function fetchSleep(from: string, to: string): Promise<GarminSleep[]> {
  const { data } = await supabaseAdmin.from('garmin_sleep').select('*').eq('user_id', 'me').gte('date', from).lte('date', to).order('date', { ascending: true })
  return (data ?? []) as GarminSleep[]
}
async function fetchBodyBattery(from: string, to: string): Promise<GarminBodyBattery[]> {
  const { data } = await supabaseAdmin.from('garmin_body_battery').select('*').eq('user_id', 'me').gte('date', from).lte('date', to).order('date', { ascending: true })
  return (data ?? []) as GarminBodyBattery[]
}
async function fetchTraining(from: string, to: string): Promise<GarminTraining[]> {
  const { data } = await supabaseAdmin.from('garmin_training').select('*').eq('user_id', 'me').gte('date', from).lte('date', to).order('date', { ascending: true })
  return (data ?? []) as GarminTraining[]
}
async function fetchLabs(from: string, to: string): Promise<HealthLab[]> {
  const { data } = await supabaseAdmin.from('health_labs').select('*').gte('date', from).lte('date', to).order('date', { ascending: true })
  return (data ?? []) as HealthLab[]
}

// Laktattest unabhängig vom Analysezeitraum — immer neuesten laden
async function fetchLatestLaktattest(): Promise<HealthLab[]> {
  const { data } = await supabaseAdmin
    .from('health_labs')
    .select('*')
    .eq('source_type', 'laktattest')
    .order('date', { ascending: false })
  return (data ?? []) as HealthLab[]
}

async function fetchNutrition(from: string, to: string): Promise<NutritionLog[]> {
  const { data } = await supabaseAdmin.from('nutrition_logs').select('*').gte('date', from).lte('date', to).order('date', { ascending: true })
  return (data ?? []) as NutritionLog[]
}

async function fetchHabits(from: string, to: string): Promise<DailyHabit[]> {
  const { data } = await supabaseAdmin.from('daily_habits').select('*').gte('date', from).lte('date', to)
  return (data ?? []) as DailyHabit[]
}

// ── Wissenschaftliche Kennzahlen berechnen ──────────────────────────────

function avg(arr: number[]): number | null {
  return arr.length === 0 ? null : arr.reduce((s, v) => s + v, 0) / arr.length
}

function classifyHRZone(avgHr: number, restingHr: number, maxHr: number): 1 | 2 | 3 | 4 | 5 {
  const pct = (avgHr - restingHr) / (maxHr - restingHr)
  if (pct < 0.6) return 1
  if (pct < 0.7) return 2
  if (pct < 0.8) return 3
  if (pct < 0.9) return 4
  return 5
}

interface ActivityStats {
  totalSessions: number; totalHours: number
  swimKm: number; bikeKm: number; runKm: number
  zoneDistribution: Record<1|2|3|4|5, number>
  polarizationIndex: { lowPct: number; midPct: number; highPct: number } | null
  runEfficiency: { avgHrPerKmh: number | null; trend: 'improving'|'stable'|'declining'|null }
  byType: Record<string, { sessions: number; hours: number; avgHr: number | null }>
  acwrValues: { date: string; acwr: number }[]
  avgAcwr: number | null
  vo2maxValues: { date: string; vo2max: number }[]
}

function computeActivityStats(activities: GarminActivity[], sleepData: GarminSleep[], trainingData: GarminTraining[], maxHr = 185): ActivityStats {
  const restingHrs = sleepData.map((s) => s.resting_hr).filter((v): v is number => v != null)
  const avgRestingHr = avg(restingHrs) ?? 50
  const zoneCounts: Record<1|2|3|4|5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const byType: ActivityStats['byType'] = {}
  // Echter HF-Mittelwert pro Sportart: Summe + Anzahl akkumulieren, am Ende teilen.
  // (Vorher: gleitendes (cur+neu)/2 — gewichtete spätere Werte exponentiell → falsch.)
  const hrAcc: Record<string, { sum: number; n: number }> = {}
  let swimKm = 0, bikeKm = 0, runKm = 0, totalMin = 0
  const runSessions: { avgHr: number; speedKmh: number; date: string }[] = []

  for (const a of activities) {
    totalMin += a.duration_min ?? 0
    const t = (a.type ?? 'other').toLowerCase()
    const km = a.distance_km ?? 0
    if (t.includes('swim')) swimKm += km
    else if (t.includes('cycl') || t.includes('bike') || t.includes('ride')) bikeKm += km
    else if (t.includes('run')) runKm += km

    if (a.avg_hr != null) {
      const zone = classifyHRZone(a.avg_hr, avgRestingHr, maxHr)
      zoneCounts[zone]++
      if (t.includes('run') && a.duration_min != null && km > 0) {
        runSessions.push({ avgHr: a.avg_hr, speedKmh: km / (a.duration_min / 60), date: a.date })
      }
    }

    const typeKey = t.includes('swim') ? 'Schwimmen' : t.includes('cycl') || t.includes('bike') ? 'Radfahren' : t.includes('run') ? 'Laufen' : t.includes('strength') || t.includes('gym') ? 'Kraft' : 'Sonstiges'
    if (!byType[typeKey]) byType[typeKey] = { sessions: 0, hours: 0, avgHr: null }
    byType[typeKey].sessions++
    byType[typeKey].hours += (a.duration_min ?? 0) / 60
    if (a.avg_hr != null) {
      const acc = hrAcc[typeKey] ?? { sum: 0, n: 0 }
      acc.sum += a.avg_hr
      acc.n += 1
      hrAcc[typeKey] = acc
    }
  }

  // HF-Mittel pro Sportart als echtes arithmetisches Mittel setzen.
  for (const k of Object.keys(byType)) {
    const acc = hrAcc[k]
    byType[k].avgHr = acc && acc.n > 0 ? Math.round(acc.sum / acc.n) : null
  }

  const total = activities.length
  const zd: Record<1|2|3|4|5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  if (total > 0) for (const z of [1,2,3,4,5] as const) zd[z] = Math.round((zoneCounts[z] / total) * 100)

  const polarizationIndex = total > 0 ? {
    lowPct: zd[1] + zd[2],
    midPct: zd[3],
    highPct: zd[4] + zd[5],
  } : null

  const runEfficiency: ActivityStats['runEfficiency'] = { avgHrPerKmh: null, trend: null }
  if (runSessions.length >= 4) {
    const mid = Math.floor(runSessions.length / 2)
    const ratios = runSessions.map((r) => r.avgHr / r.speedKmh)
    const first = avg(ratios.slice(0, mid))
    const second = avg(ratios.slice(mid))
    runEfficiency.avgHrPerKmh = avg(ratios) ? Math.round(avg(ratios)! * 10) / 10 : null
    if (first != null && second != null) {
      runEfficiency.trend = second - first < -1 ? 'improving' : second - first > 1 ? 'declining' : 'stable'
    }
  }

  const acwrValues = trainingData.filter((t) => t.acwr != null).map((t) => ({ date: t.date, acwr: t.acwr! }))
  const vo2maxValues = trainingData.filter((t) => t.vo2max != null).map((t) => ({ date: t.date, vo2max: t.vo2max! }))

  return {
    totalSessions: total,
    totalHours: Math.round((totalMin / 60) * 10) / 10,
    swimKm: Math.round(swimKm * 10) / 10,
    bikeKm: Math.round(bikeKm * 10) / 10,
    runKm: Math.round(runKm * 10) / 10,
    zoneDistribution: zd,
    polarizationIndex,
    runEfficiency,
    byType,
    acwrValues,
    avgAcwr: avg(acwrValues.map((v) => v.acwr)) ? Math.round(avg(acwrValues.map((v) => v.acwr))! * 100) / 100 : null,
    vo2maxValues,
  }
}

interface SleepStats {
  avgScore: number | null; avgDurationMin: number | null
  avgHrvNightly: number | null; avgRestingHr: number | null
  avgDeepPct: number | null; avgRemPct: number | null
  hrvTrend: 'improving'|'stable'|'declining'|null
  nightsWithData: number; stressAvg: number | null; bodyBatteryAvg: number | null
  // Wochen-Durchschnitte für Verlaufskorrelation
  weeklyHrv: { week: string; avgHrv: number }[]
  weeklyStress: { week: string; avgStress: number }[]
}

function computeSleepStats(sleepData: GarminSleep[], batteryData: GarminBodyBattery[]): SleepStats {
  const scores = sleepData.map((s) => s.sleep_score).filter((v): v is number => v != null)
  const durations = sleepData.map((s) => s.total_sleep_min).filter((v): v is number => v != null)
  const hrvsNightly = sleepData.map((s) => s.hrv_nightly).filter((v): v is number => v != null)
  const restingHrs = sleepData.map((s) => s.resting_hr).filter((v): v is number => v != null)
  const deepPcts = sleepData.filter((s) => s.total_sleep_min! > 0 && s.deep_sleep_min != null).map((s) => (s.deep_sleep_min! / s.total_sleep_min!) * 100)
  const remPcts = sleepData.filter((s) => s.total_sleep_min! > 0 && s.rem_sleep_min != null).map((s) => (s.rem_sleep_min! / s.total_sleep_min!) * 100)

  let hrvTrend: SleepStats['hrvTrend'] = null
  if (hrvsNightly.length >= 6) {
    const mid = Math.floor(hrvsNightly.length / 2)
    const first = avg(hrvsNightly.slice(0, mid))
    const second = avg(hrvsNightly.slice(mid))
    if (first != null && second != null) {
      hrvTrend = second - first > 2 ? 'improving' : second - first < -2 ? 'declining' : 'stable'
    }
  }

  // Wöchentliche Aggregierung für Korrelationsanalyse
  const weeklyHrvMap = new Map<string, number[]>()
  const weeklyStressMap = new Map<string, number[]>()
  for (const s of sleepData) {
    const d = new Date(s.date)
    const weekKey = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() - d.getDay() + 6) / 7)).padStart(2, '0')}`
    if (s.hrv_nightly != null) {
      if (!weeklyHrvMap.has(weekKey)) weeklyHrvMap.set(weekKey, [])
      weeklyHrvMap.get(weekKey)!.push(s.hrv_nightly)
    }
  }
  for (const b of batteryData) {
    const d = new Date(b.date)
    const weekKey = `${d.getFullYear()}-W${String(Math.ceil((d.getDate() - d.getDay() + 6) / 7)).padStart(2, '0')}`
    if (b.stress_avg != null) {
      if (!weeklyStressMap.has(weekKey)) weeklyStressMap.set(weekKey, [])
      weeklyStressMap.get(weekKey)!.push(b.stress_avg)
    }
  }

  const stressVals = batteryData.map((b) => b.stress_avg).filter((v): v is number => v != null)
  const batteryVals = batteryData.map((b) => b.morning_score).filter((v): v is number => v != null)

  return {
    avgScore: avg(scores) != null ? Math.round(avg(scores)!) : null,
    avgDurationMin: avg(durations) != null ? Math.round(avg(durations)!) : null,
    avgHrvNightly: avg(hrvsNightly) != null ? Math.round(avg(hrvsNightly)!) : null,
    avgRestingHr: avg(restingHrs) != null ? Math.round(avg(restingHrs)!) : null,
    avgDeepPct: avg(deepPcts) != null ? Math.round(avg(deepPcts)!) : null,
    avgRemPct: avg(remPcts) != null ? Math.round(avg(remPcts)!) : null,
    hrvTrend,
    nightsWithData: scores.length,
    stressAvg: avg(stressVals) != null ? Math.round(avg(stressVals)!) : null,
    bodyBatteryAvg: avg(batteryVals) != null ? Math.round(avg(batteryVals)!) : null,
    weeklyHrv: Array.from(weeklyHrvMap.entries()).map(([week, vals]) => ({ week, avgHrv: Math.round(avg(vals)!) })).sort((a, b) => a.week.localeCompare(b.week)),
    weeklyStress: Array.from(weeklyStressMap.entries()).map(([week, vals]) => ({ week, avgStress: Math.round(avg(vals)!) })).sort((a, b) => a.week.localeCompare(b.week)),
  }
}

// ── Laktattest parsen ──────────────────────────────────────────────────────

interface LaktattestData {
  date: string
  lt1Pace: string | null   // z.B. "4:30 min/km"
  lt1Hr: number | null
  lt2Pace: string | null
  lt2Hr: number | null
  ftpWatts: number | null
  criticalPower: number | null
  hfmax: number | null
  sportType: string | null // Laufen / Radfahren / Schwimmen
  raw: HealthLab[]
}

function parseLaktattest(labs: HealthLab[]): LaktattestData | null {
  if (labs.length === 0) return null
  // Alle Einträge gehören zum selben Test-Datum (neuestes)
  const latestDate = labs[0].date
  const entries = labs.filter((l) => l.date === latestDate)

  const find = (keywords: string[]): number | null => {
    for (const kw of keywords) {
      const e = entries.find((l) => l.test_name.toLowerCase().includes(kw.toLowerCase()))
      if (e?.value != null) return e.value
    }
    return null
  }
  const findStr = (keywords: string[]): string | null => {
    for (const kw of keywords) {
      const e = entries.find((l) => l.test_name.toLowerCase().includes(kw.toLowerCase()))
      if (e?.notes) return e.notes
    }
    return null
  }

  // Sport-Typ aus Eintragnamen ableiten
  const allNames = entries.map((e) => e.test_name.toLowerCase()).join(' ')
  const sportType = allNames.includes('lauf') || allNames.includes('run') ? 'Laufen'
    : allNames.includes('rad') || allNames.includes('bike') || allNames.includes('cycl') ? 'Radfahren'
    : allNames.includes('swim') || allNames.includes('schwimm') ? 'Schwimmen'
    : null

  return {
    date: latestDate,
    lt1Hr: find(['LT1 HR', 'LT1 Herzfrequenz', 'LT1 bpm', 'LT 1 HR']),
    lt1Pace: findStr(['LT1 Pace', 'LT1 Tempo', 'LT 1 Pace']),
    lt2Hr: find(['LT2 HR', 'LT2 Herzfrequenz', 'LT2 bpm', 'LT 2 HR', 'LT2']),
    lt2Pace: findStr(['LT2 Pace', 'LT2 Tempo', 'LT 2 Pace']),
    ftpWatts: find(['FTP', 'Functional Threshold', 'ftp']),
    criticalPower: find(['Critical Power', 'CP', 'critical power']),
    hfmax: find(['HFmax', 'HF max', 'Max HR', 'max_hr', 'Maximale HR', 'maximale Herzfrequenz']),
    sportType,
    raw: entries,
  }
}

// ── Warn-Signale & SER ─────────────────────────────────────────────────────

interface WarningSignals {
  ser: number | null             // Stress:Erholungs-Ratio (> 2 = Warnsignal)
  hrvBelowBaselineDays: number   // Tage mit HRV unter Baseline
  rhrElevatedDays: number        // Tage mit RHR ≥ Baseline + 5 bpm
  bbLowMorningDays: number       // Tage mit Body Battery morgens < 30
  shortSleepNights: number       // Nächte < 6h
  flags: string[]                // konkrete Warntexte
}

function computeWarningSignals(sleepData: GarminSleep[], batteryData: GarminBodyBattery[]): WarningSignals {
  // SER über gesamten Zeitraum
  let totalStressMin = 0, totalRestMin = 0
  for (const b of batteryData) {
    totalStressMin += (b.stress_min_low ?? 0) + (b.stress_min_med ?? 0) + (b.stress_min_high ?? 0)
    totalRestMin += b.rest_min ?? 0
  }
  const ser = totalRestMin > 0 ? Math.round((totalStressMin / totalRestMin) * 10) / 10 : null

  let hrvBelowDays = 0, rhrElevDays = 0, bbLowDays = 0, shortSleepNights = 0
  for (const s of sleepData) {
    if (s.hrv_nightly != null && s.hrv_baseline_low != null && s.hrv_nightly < s.hrv_baseline_low) hrvBelowDays++
    if (s.resting_hr != null && s.rhr_7day_avg != null && s.resting_hr >= s.rhr_7day_avg + 5) rhrElevDays++
    if (s.total_sleep_min != null && s.total_sleep_min < 360) shortSleepNights++
  }
  for (const b of batteryData) {
    if (b.morning_score != null && b.morning_score < 30) bbLowDays++
  }

  const flags: string[] = []
  if (ser != null && ser > 2) flags.push(`SER ${ser} (> 2 — Stressminuten überwiegen Erholungsminuten deutlich)`)
  if (hrvBelowDays >= 3) flags.push(`HRV ${hrvBelowDays} Tage unter persönlicher Baseline`)
  if (rhrElevDays >= 3) flags.push(`Ruhepuls ${rhrElevDays} Tage ≥ Baseline +5 bpm`)
  if (bbLowDays >= 3) flags.push(`Body Battery morgens < 30 an ${bbLowDays} Tagen`)
  if (shortSleepNights >= 3) flags.push(`${shortSleepNights} Nächte unter 6 Stunden Schlaf`)

  return { ser, hrvBelowBaselineDays: hrvBelowDays, rhrElevatedDays: rhrElevDays, bbLowMorningDays: bbLowDays, shortSleepNights, flags }
}

// ── Ernährungsstatistik ────────────────────────────────────────────────────

interface NutritionStats {
  daysLogged: number
  avgCalories: number | null
  avgProtein: number | null
  weeklyAvg: { week: string; kcal: number | null; protein: number | null }[]
}

function computeNutritionStats(logs: NutritionLog[]): NutritionStats {
  if (logs.length === 0) return { daysLogged: 0, avgCalories: null, avgProtein: null, weeklyAvg: [] }

  const kcals = logs.map((l) => l.calories).filter((v): v is number => v != null)
  const proteins = logs.map((l) => l.protein_g).filter((v): v is number => v != null)

  const weeklyMap = new Map<string, { kcal: number[]; protein: number[] }>()
  for (const l of logs) {
    const d = new Date(l.date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const weekKey = new Date(d.getFullYear(), d.getMonth(), diff).toISOString().slice(0, 10)
    if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, { kcal: [], protein: [] })
    const w = weeklyMap.get(weekKey)!
    if (l.calories != null) w.kcal.push(l.calories)
    if (l.protein_g != null) w.protein.push(l.protein_g)
  }

  const weeklyAvg = Array.from(weeklyMap.entries())
    .map(([week, d]) => ({
      week,
      kcal: d.kcal.length ? Math.round(d.kcal.reduce((a, b) => a + b, 0) / d.kcal.length) : null,
      protein: d.protein.length ? Math.round(d.protein.reduce((a, b) => a + b, 0) / d.protein.length) : null,
    }))
    .sort((a, b) => a.week.localeCompare(b.week))

  return {
    daysLogged: logs.length,
    avgCalories: kcals.length ? Math.round(kcals.reduce((a, b) => a + b, 0) / kcals.length) : null,
    avgProtein: proteins.length ? Math.round(proteins.reduce((a, b) => a + b, 0) / proteins.length) : null,
    weeklyAvg,
  }
}

// ── Habit-Statistik ────────────────────────────────────────────────────────

interface HabitStats {
  totalHabits: string[]
  completionRates: { habit: string; rate: number; completed: number; total: number }[]
  overallRate: number | null
}

function computeHabitStats(habits: DailyHabit[]): HabitStats {
  if (habits.length === 0) return { totalHabits: [], completionRates: [], overallRate: null }

  const byHabit = new Map<string, { done: number; total: number }>()
  for (const h of habits) {
    if (!byHabit.has(h.habit_name)) byHabit.set(h.habit_name, { done: 0, total: 0 })
    const e = byHabit.get(h.habit_name)!
    e.total++
    if (h.completed) e.done++
  }

  const completionRates = Array.from(byHabit.entries())
    .map(([habit, { done, total }]) => ({ habit, rate: Math.round((done / total) * 100), completed: done, total }))
    .sort((a, b) => a.rate - b.rate) // niedrigste zuerst (Verbesserungspotenzial oben)

  const allDone = habits.filter((h) => h.completed).length
  const overallRate = habits.length > 0 ? Math.round((allDone / habits.length) * 100) : null

  return { totalHabits: Array.from(byHabit.keys()), completionRates, overallRate }
}

// ── Prüfungswochen aus Kalender ────────────────────────────────────────────

interface ExamWeek {
  weekStart: string
  events: string[]
}

async function fetchExamWeeks(from: string, to: string): Promise<ExamWeek[]> {
  try {
    const events = await fetchCalendarEvents(new Date(from), new Date(to))
    const examEvents = events.filter((e) => isExamEvent(e.title))
    const byWeek = new Map<string, string[]>()
    for (const e of examEvents) {
      const d = new Date(e.start)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const weekKey = new Date(d.getFullYear(), d.getMonth(), diff).toISOString().slice(0, 10)
      if (!byWeek.has(weekKey)) byWeek.set(weekKey, [])
      byWeek.get(weekKey)!.push(e.title)
    }
    return Array.from(byWeek.entries()).map(([weekStart, events]) => ({ weekStart, events })).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  } catch {
    return []
  }
}

// ── Datenbasis für Claude aufbauen ──────────────────────────────────────────

function buildDataContext(
  period: ReviewPeriod,
  from: string,
  to: string,
  acts: ActivityStats,
  sleep: SleepStats,
  labs: HealthLab[],
  laktat: LaktattestData | null,
  warnings: WarningSignals,
  nutrition: NutritionStats,
  habitStats: HabitStats,
  examWeeks: ExamWeek[],
): string {
  const lines: string[] = [
    `## Rohdaten-Zusammenfassung: ${from} bis ${to}`,
    '',
    '### Training',
    `- Einheiten gesamt: ${acts.totalSessions}`,
    `- Trainingszeit gesamt: ${acts.totalHours} h`,
    `- Volumen: Schwimmen ${acts.swimKm} km | Radfahren ${acts.bikeKm} km | Laufen ${acts.runKm} km`,
    '',
    '**HR-Zonenverteilung (Karvonen, % der Einheiten):**',
    `- Zone 1 (<60% HFR): ${acts.zoneDistribution[1]}%`,
    `- Zone 2 (60-70% HFR): ${acts.zoneDistribution[2]}%`,
    `- Zone 3 (70-80% HFR, Grauzone): ${acts.zoneDistribution[3]}%`,
    `- Zone 4 (80-90% HFR): ${acts.zoneDistribution[4]}%`,
    `- Zone 5 (>90% HFR): ${acts.zoneDistribution[5]}%`,
  ]

  if (acts.polarizationIndex) {
    const { lowPct, midPct, highPct } = acts.polarizationIndex
    lines.push(
      `- Polarisierungs-Index: ${lowPct}% niedrig (Z1+2) | ${midPct}% mittel (Z3) | ${highPct}% hoch (Z4+5)`,
      `- 80/20-Bewertung: ${lowPct >= 75 ? '✅ Eingehalten' : lowPct >= 65 ? '⚠️ Grenzwertig' : '❌ Nicht eingehalten'}`,
    )
  }

  lines.push('', '**Nach Sportart:**')
  for (const [type, s] of Object.entries(acts.byType)) {
    lines.push(`- ${type}: ${s.sessions} Einheiten, ${Math.round(s.hours * 10) / 10} h${s.avgHr ? `, Ø HR ${Math.round(s.avgHr)} bpm` : ''}`)
  }

  if (acts.runEfficiency.avgHrPerKmh != null) {
    const trendLabel = acts.runEfficiency.trend === 'improving' ? '↗ Verbesserung' : acts.runEfficiency.trend === 'declining' ? '↘ Abnahme' : '→ Stabil'
    lines.push('', `**Lauf-Effizienz:** ${acts.runEfficiency.avgHrPerKmh} bpm/(km/h) | Trend: ${trendLabel}`)
  }

  if (acts.acwrValues.length > 0) {
    lines.push('', '**ACWR-Verlauf (Auszug, letzte 8 Werte):**')
    const sample = acts.acwrValues.slice(-8)
    for (const v of sample) lines.push(`- ${v.date}: ${v.acwr} ${v.acwr > 1.4 ? '⚠️' : v.acwr < 0.8 ? '🟡' : '✅'}`)
    if (acts.avgAcwr != null) lines.push(`- Durchschnitt: ${acts.avgAcwr} (Optimum: 0.8-1.3)`)
  }

  if (acts.vo2maxValues.length > 0) {
    const first = acts.vo2maxValues[0]
    const last = acts.vo2maxValues[acts.vo2maxValues.length - 1]
    lines.push(`- VO2max: ${first.date}: ${first.vo2max} → ${last.date}: ${last.vo2max} ml/(kg·min) (Garmin-Schätzwert)`)
  }

  lines.push('', '### Schlaf & Erholung',
    `- Auswertbare Nächte: ${sleep.nightsWithData}`,
    `- Schlaf-Score Ø: ${sleep.avgScore ?? '—'}`,
    `- Schlafdauer Ø: ${sleep.avgDurationMin != null ? `${Math.floor(sleep.avgDurationMin / 60)}h ${sleep.avgDurationMin % 60}min` : '—'}`,
    `- HRV nächtlich Ø: ${sleep.avgHrvNightly ?? '—'} ms | Trend: ${sleep.hrvTrend ?? 'zu wenig Daten'}`,
    `- Resting HR Ø: ${sleep.avgRestingHr ?? '—'} bpm`,
    `- Tiefschlaf Ø: ${sleep.avgDeepPct ?? '—'}% (Norm: 15-25%)`,
    `- REM Ø: ${sleep.avgRemPct ?? '—'}% (Norm: 20-25%)`,
    `- Stress-Score Ø: ${sleep.stressAvg ?? '—'} (Norm: <50)`,
    `- Body Battery morgens Ø: ${sleep.bodyBatteryAvg ?? '—'}`,
  )

  if (sleep.weeklyHrv.length > 0) {
    lines.push('', '**Wöchentliche HRV (für Korrelationsanalyse):**')
    for (const w of sleep.weeklyHrv) lines.push(`- ${w.week}: ${w.avgHrv} ms`)
  }

  if (labs.length > 0) {
    lines.push('', '### Laborwerte (im Analysezeitraum)')
    const byTest = new Map<string, HealthLab>()
    for (const lab of labs) byTest.set(lab.test_name, lab)
    for (const [name, lab] of byTest.entries()) {
      const ref = lab.reference_min != null || lab.reference_max != null ? ` (Norm: ${lab.reference_min ?? ''}–${lab.reference_max ?? ''} ${lab.unit ?? ''})` : ''
      lines.push(`- ${name}: ${lab.value ?? '—'} ${lab.unit ?? ''} [${lab.status}]${ref} (${lab.date})`)
    }
  }

  // Laktattest / Leistungsdiagnostik (unabhängig vom Zeitraum — neuester Test)
  if (laktat) {
    lines.push('', '### Leistungsdiagnostik (neuester Laktattest)')
    lines.push(`- Testdatum: ${laktat.date}${laktat.sportType ? ` | Sportart: ${laktat.sportType}` : ''}`)
    if (laktat.lt1Hr != null || laktat.lt1Pace) {
      const lt1 = [laktat.lt1Hr ? `${laktat.lt1Hr} bpm` : null, laktat.lt1Pace].filter(Boolean).join(' bei ')
      lines.push(`- LT1 (aerobe Schwelle): ${lt1 || '—'}`)
    }
    if (laktat.lt2Hr != null || laktat.lt2Pace) {
      const lt2 = [laktat.lt2Hr ? `${laktat.lt2Hr} bpm` : null, laktat.lt2Pace].filter(Boolean).join(' bei ')
      lines.push(`- LT2 (anaerobe Schwelle): ${lt2 || '—'}`)
    }
    if (laktat.ftpWatts != null) lines.push(`- FTP: ${laktat.ftpWatts} W`)
    if (laktat.criticalPower != null) lines.push(`- Critical Power: ${laktat.criticalPower} W`)
    if (laktat.hfmax != null) lines.push(`- HFmax (gemessen): ${laktat.hfmax} bpm`)
    // Alle Rohwerte des Tests
    lines.push('- Alle Testwerte:')
    for (const e of laktat.raw) {
      lines.push(`  - ${e.test_name}: ${e.value ?? '—'} ${e.unit ?? ''}${e.notes ? ` (${e.notes})` : ''}`)
    }
    // Trainingsauswertung relativ zu Schwellen
    if (laktat.lt2Hr != null && acts.byType['Laufen']) {
      const runAvgHr = acts.byType['Laufen'].avgHr
      if (runAvgHr != null) {
        const zone = runAvgHr < laktat.lt2Hr * 0.9 ? 'unter LT2 (aerob)' : 'um/über LT2 (intensiv)'
        lines.push(`- Lauf-Ø-HR ${Math.round(runAvgHr)} bpm → ${zone} (LT2 bei ${laktat.lt2Hr} bpm)`)
      }
    }
  } else {
    lines.push('', '### Leistungsdiagnostik: Kein Laktattest in der Datenbank')
  }

  // Warn-Signale
  if (warnings.flags.length > 0) {
    lines.push('', '### ⚠️ Aktive Warnsignale')
    for (const f of warnings.flags) lines.push(`- ${f}`)
  } else {
    lines.push('', '### Warnsignale: Keine aktiven Warnsignale ✅')
  }
  if (warnings.ser != null) {
    lines.push(`- SER (Stress:Erholungs-Ratio) Gesamtzeitraum: ${warnings.ser} (Ziel: < 2)`)
  }

  // Ernährung
  if (nutrition.daysLogged > 0) {
    lines.push('', '### Ernährung')
    lines.push(`- Erfasste Tage: ${nutrition.daysLogged}`)
    lines.push(`- Kalorien Ø: ${nutrition.avgCalories ?? '—'} kcal (Zielbereich prüfen)`)
    lines.push(`- Protein Ø: ${nutrition.avgProtein ?? '—'} g`)
    if (nutrition.weeklyAvg.length > 0) {
      lines.push('- Wöchentliche Durchschnitte:')
      for (const w of nutrition.weeklyAvg) {
        lines.push(`  - KW ${w.week}: ${w.kcal ?? '—'} kcal | ${w.protein ?? '—'} g Protein`)
      }
    }
  } else {
    lines.push('', '### Ernährung: Keine Einträge im Zeitraum')
  }

  // Gewohnheiten
  if (habitStats.completionRates.length > 0) {
    lines.push('', '### Gewohnheiten')
    lines.push(`- Gesamt-Erfüllungsquote: ${habitStats.overallRate ?? '—'}%`)
    for (const h of habitStats.completionRates) {
      lines.push(`- ${h.habit}: ${h.rate}% (${h.completed}/${h.total} Tage)`)
    }
  } else {
    lines.push('', '### Gewohnheiten: Keine Einträge im Zeitraum')
  }

  // Prüfungswochen
  if (examWeeks.length > 0) {
    lines.push('', '### Prüfungswochen im Analysezeitraum')
    for (const ew of examWeeks) {
      lines.push(`- Woche ab ${ew.weekStart}: ${ew.events.join(', ')}`)
    }
  }

  return lines.join('\n')
}

// ── Obsidian-Ordnerstruktur ─────────────────────────────────────────────────

function obsidianFolder(period: ReviewPeriod): string {
  return period === 'monthly' ? 'Monatsbericht' : period === 'halfyear' ? 'Halbjährig' : 'Jahresberichte'
}

// ── Haupt-Export ─────────────────────────────────────────────────────────

export async function runHealthReview(period: ReviewPeriod): Promise<string> {
  const { from, to } = periodDates(period)
  const label = periodLabel(period, from, to)

  // Alle Daten parallel laden
  const [analysisParams, activities, sleepData, batteryData, trainingData, labs, laktatLabs, nutritionLogs, habits, examWeeks] = await Promise.all([
    loadAnalysisParams(),
    fetchActivities(from, to),
    fetchSleep(from, to),
    fetchBodyBattery(from, to),
    fetchTraining(from, to),
    fetchLabs(from, to),
    fetchLatestLaktattest(),
    fetchNutrition(from, to),
    fetchHabits(from, to),
    fetchExamWeeks(from, to),
  ])

  // Sicherstellen dass die Parameter-Datei in Obsidian existiert
  void ensureParamsFileExists()

  if (activities.length === 0 && sleepData.length === 0) {
    return `⚠️ Keine Garmin-Daten für ${label} gefunden.`
  }

  // MaxHR aus Parametern extrahieren (einfaches Regex)
  const maxHrMatch = analysisParams.match(/Maximale Herzfrequenz[^:]*:\s*(\d+)/)
  const maxHr = maxHrMatch ? parseInt(maxHrMatch[1], 10) : 185

  const actStats = computeActivityStats(activities, sleepData, trainingData, maxHr)
  const sleepStats = computeSleepStats(sleepData, batteryData)
  const laktat = parseLaktattest(laktatLabs)
  const warnings = computeWarningSignals(sleepData, batteryData)
  const nutrition = computeNutritionStats(nutritionLogs)
  const habitStats = computeHabitStats(habits)
  const dataContext = buildDataContext(period, from, to, actStats, sleepStats, labs, laktat, warnings, nutrition, habitStats, examWeeks)

  const periodText = period === 'monthly' ? 'einen Monat' : period === 'halfyear' ? '6 Monate' : '12 Monate'
  const model = period === 'monthly' ? 'claude-sonnet-4-6' : 'claude-opus-4-8'

  const laktatContext = laktat
    ? `\nLeistungsdiagnostik (${laktat.date}): LT1 ${laktat.lt1Hr ?? '?'} bpm, LT2 ${laktat.lt2Hr ?? '?'} bpm, FTP ${laktat.ftpWatts ?? '?'} W — verwende diese Werte bei der Trainingsauswertung.`
    : ''
  const examContext = examWeeks.length > 0
    ? `\nPrüfungswochen im Zeitraum: ${examWeeks.map((e) => e.weekStart).join(', ')} — analysiere ob Schlaf, Stress oder Trainingsvolumen in diesen Wochen auffällig abweichen.`
    : ''

  const systemPrompt = `Du bist ein Sportwissenschaftler und analysierst persönliche Trainings- und Gesundheitsdaten.
Zeitraum der Analyse: ${periodText} (${from} bis ${to}).${laktatContext}${examContext}

Die folgenden Analyse-Parameter und wissenschaftlichen Normen gelten für diese Person:

${analysisParams}

---
Format des Berichts (Markdown, auf Deutsch):
1. **Executive Summary** (3-5 Sätze: wichtigste Erkenntnisse, direkt und konkret)
2. **Training** (Volumen, Intensitätsverteilung, Polarisierungsindex, ACWR, Lauf-Effizienz, VO2max-Trend; falls Laktattest vorhanden: Auswertung relativ zu LT1/LT2/FTP)
3. **Schlaf & Erholung** (Score, Schlafdauer, Schlafphasen vs. Norm, HRV-Trend, Stress, Body Battery, SER)
4. **Gesundheit & Lifestyle** (Laborwerte, Ernährung Ø-Kalorien/Protein vs. Ziel, Habit-Erfüllungsquoten)
5. **Korrelationen** — belege mit konkreten Zahlen:
   - ACWR > 1.4 gleichzeitig mit negativem HRV-Trend → Überlastungs-Cluster benennen
   - In Prüfungswochen: Schlafdauer, Stress und Trainingsvolumen vs. Nicht-Prüfungswochen vergleichen
   - Wochen mit hohem SER → Schlafqualität und Erholung vergleichen
6. **Empfehlungen** (Format: Beobachtung → Mechanismus → Empfehlung (Quelle). Max. 5, nach Priorität)

Verwende ausschließlich die bereitgestellten Daten. Keine Spekulationen. Fehlende Daten klar benennen.`

  const message = await anthropic.messages.create({
    model,
    max_tokens: period === 'monthly' ? 2500 : 4500,
    system: systemPrompt,
    messages: [{ role: 'user', content: dataContext }],
  })

  const review = message.content[0].type === 'text' ? message.content[0].text : ''
  const fullReport = [
    `---`,
    `type: health-review`,
    `period: ${period}`,
    `generated: ${new Date().toISOString().slice(0, 10)}`,
    `from: ${from}`,
    `to: ${to}`,
    `model: ${model}`,
    `---`,
    '',
    `# Gesundheits- & Trainingsanalyse — ${label}`,
    '',
    review,
    '',
    '---',
    `*Generiert am ${new Date().toISOString().slice(0, 10)} · ${activities.length} Aktivitäten · ${sleepData.length} Nächte · Parameter: [[analyse-parameter]]*`,
  ].join('\n')

  const folder = obsidianFolder(period)
  const vaultPath = `Gesundheit/Training/${folder}/${label}.md`
  const obsidianOk = await writeObsidianFile(vaultPath, fullReport)

  await supabaseAdmin.from('knowledge_entries').insert({
    user_id: 'me',
    raw_text: fullReport,
    summary: `Gesundheits- & Trainingsanalyse ${label}`,
    category: 'Gesundheit',
    source: `health_review_${period}`,
    tags: ['training', 'schlaf', 'gesundheit', period, label],
  })

  const { dateKey, timeBerlin } = berlinNow()
  void appendToDailyLog({
    kind: 'note', timeBerlin, dateKey,
    content: `Gesundheitsanalyse (${period}) generiert → Obsidian: ${vaultPath}`,
  })

  const obsNote = obsidianOk ? '' : '\n⚠️ Obsidian nicht erreichbar — in Supabase gespeichert.'
  return `📊 *Analyse ${label} fertig*\n\nObsidian: Gesundheit/Training/${folder}/${label}.md\n_Parameter bearbeiten: analyse-parameter.md_${obsNote}`
}

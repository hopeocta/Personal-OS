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

// ISO date of the Monday of the week containing dateStr
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
function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}
// Population standard deviation
function sd(arr: number[]): number | null {
  if (arr.length < 2) return null
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length
  return Math.round(Math.sqrt(v))
}
// All ISO dates from `from` to `to` inclusive
function eachDate(from: Date, to: Date): string[] {
  const out: string[] = []
  const d = new Date(from)
  while (d <= to) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const weeks = [4, 8, 12].includes(body.weeks) ? (body.weeks as number) : 8

  const today = new Date()
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)
  const sinceStr = since.toISOString().slice(0, 10)

  const [sleepRes, activitiesRes, batteryRes, trainingRes, strengthRes, habitsRes, nutritionRes] =
    await Promise.all([
      supabaseAdmin.from('garmin_sleep').select('*').gte('date', sinceStr).order('date'),
      supabaseAdmin.from('garmin_activities').select('*').gte('date', sinceStr).order('date'),
      supabaseAdmin.from('garmin_body_battery').select('*').gte('date', sinceStr).order('date'),
      supabaseAdmin.from('garmin_training').select('*').gte('date', sinceStr).order('date'),
      supabaseAdmin.from('strength_sessions').select('*').gte('date', sinceStr).order('date'),
      supabaseAdmin.from('daily_habits').select('*').gte('date', sinceStr),
      supabaseAdmin.from('nutrition_logs').select('*').gte('date', sinceStr),
    ])

  for (const [name, res] of [
    ['sleep', sleepRes], ['activities', activitiesRes], ['battery', batteryRes],
    ['training', trainingRes], ['strength', strengthRes], ['habits', habitsRes], ['nutrition', nutritionRes],
  ] as const) {
    if (res.error) console.error(`[analyse] ${name} fetch error:`, res.error)
  }

  // ---- Daily maps (for warning scans + training/rest classification) ----
  type SleepRow = {
    date: string; sleep_score: number | null; hrv_nightly: number | null
    total_sleep_min: number | null; deep_sleep_min: number | null; resting_hr: number | null
    hrv_status: string | null; hrv_baseline_low: number | null; hrv_baseline_high: number | null
    hrv_weekly_avg: number | null; rhr_7day_avg: number | null
  }
  type BbRow = { date: string; morning_score: number | null; stress_avg: number | null; stress_min_low: number | null; stress_min_med: number | null; stress_min_high: number | null; rest_min: number | null }
  type TrRow = { date: string; vo2max: number | null; atl: number | null; ctl: number | null; acwr: number | null; acwr_status: string | null; status_phrase: string | null }

  const sleepByDate = new Map<string, SleepRow>()
  for (const r of (sleepRes.data ?? []) as SleepRow[]) sleepByDate.set(r.date, r)
  const bbByDate = new Map<string, BbRow>()
  for (const r of (batteryRes.data ?? []) as BbRow[]) bbByDate.set(r.date, r)
  const trByDate = new Map<string, TrRow>()
  for (const r of (trainingRes.data ?? []) as TrRow[]) trByDate.set(r.date, r)

  const actDurByDate = new Map<string, number>()
  for (const a of activitiesRes.data ?? []) {
    if (a.duration_min != null) actDurByDate.set(a.date, (actDurByDate.get(a.date) ?? 0) + a.duration_min)
  }
  const strIntByDate = new Map<string, number>()
  for (const s of strengthRes.data ?? []) {
    strIntByDate.set(s.date, Math.max(strIntByDate.get(s.date) ?? 0, s.intensity))
  }

  // ---- Per-week aggregation across the whole window ----
  type Week = {
    hrvN: number[]; hrvWeekly: number[]; rhr: number[]; sleepH: number[]; sleepMin: number[]; deepH: number[]
    sleepScore: number[]; morningBB: number[]; stressAvg: number[]; stressMin: number[]; restMin: number[]
    vo2: number[]; atl: number[]; ctl: number[]; acwr: number[]
    trainMin: number; hardDays: number; restDays: number; trainDays: number
    nightsShort: number; hrvBelowDays: number; rhrElevDays: number; bbLowDays: number
    hrvStatusLast: string | null; statusPhraseLast: string | null
  }
  const W: Record<string, Week> = {}
  const wk = (d: string): Week => {
    const k = getWeekStart(d)
    if (!W[k])
      W[k] = {
        hrvN: [], hrvWeekly: [], rhr: [], sleepH: [], sleepMin: [], deepH: [], sleepScore: [],
        morningBB: [], stressAvg: [], stressMin: [], restMin: [], vo2: [], atl: [], ctl: [], acwr: [],
        trainMin: 0, hardDays: 0, restDays: 0, trainDays: 0,
        nightsShort: 0, hrvBelowDays: 0, rhrElevDays: 0, bbLowDays: 0,
        hrvStatusLast: null, statusPhraseLast: null,
      }
    return W[k]
  }

  // Consecutive-run trackers for the headline warning signals (guide: 3+ days)
  const hrvBelowFlags: { date: string; flag: boolean }[] = []
  const rhrElevFlags: { date: string; flag: boolean }[] = []

  for (const date of eachDate(since, today)) {
    const w = wk(date)
    const s = sleepByDate.get(date)
    const bb = bbByDate.get(date)
    const tr = trByDate.get(date)

    if (s) {
      if (s.hrv_nightly != null) w.hrvN.push(s.hrv_nightly)
      if (s.hrv_weekly_avg != null) w.hrvWeekly.push(s.hrv_weekly_avg)
      if (s.resting_hr != null) w.rhr.push(s.resting_hr)
      if (s.total_sleep_min != null) { w.sleepH.push(s.total_sleep_min / 60); w.sleepMin.push(s.total_sleep_min) }
      if (s.deep_sleep_min != null) w.deepH.push(s.deep_sleep_min / 60)
      if (s.sleep_score != null) w.sleepScore.push(s.sleep_score)
      if (s.hrv_status) w.hrvStatusLast = s.hrv_status
      if (s.total_sleep_min != null && s.total_sleep_min < 360) w.nightsShort++
    }
    if (bb) {
      if (bb.morning_score != null) w.morningBB.push(bb.morning_score)
      if (bb.stress_avg != null) w.stressAvg.push(bb.stress_avg)
      const sm = (bb.stress_min_low ?? 0) + (bb.stress_min_med ?? 0) + (bb.stress_min_high ?? 0)
      if (bb.stress_min_low != null || bb.stress_min_med != null || bb.stress_min_high != null) w.stressMin.push(sm)
      if (bb.rest_min != null) w.restMin.push(bb.rest_min)
      if (bb.morning_score != null && bb.morning_score < 30) w.bbLowDays++
    }
    if (tr) {
      if (tr.vo2max != null) w.vo2.push(tr.vo2max)
      if (tr.atl != null) w.atl.push(tr.atl)
      if (tr.ctl != null) w.ctl.push(tr.ctl)
      if (tr.acwr != null) w.acwr.push(tr.acwr)
      if (tr.status_phrase) w.statusPhraseLast = tr.status_phrase
    }

    // training / rest day classification
    const dur = actDurByDate.get(date) ?? 0
    const strInt = strIntByDate.get(date)
    const hasAct = dur > 0
    const trainingDay = hasAct || strInt != null
    w.trainMin += dur
    if (trainingDay) w.trainDays++
    else w.restDays++
    if (dur >= 60 || strInt === 3) w.hardDays++

    // warning flags
    const hrvBelow = !!s && s.hrv_nightly != null && s.hrv_baseline_low != null && s.hrv_nightly < s.hrv_baseline_low
    const rhrElev = !!s && s.resting_hr != null && s.rhr_7day_avg != null && s.resting_hr >= s.rhr_7day_avg + 5
    if (hrvBelow) w.hrvBelowDays++
    if (rhrElev) w.rhrElevDays++
    hrvBelowFlags.push({ date, flag: hrvBelow })
    rhrElevFlags.push({ date, flag: rhrElev })
  }

  // Longest 3+ day runs (consecutive) → concrete actionable warnings
  function runs(flags: { date: string; flag: boolean }[]): string[] {
    const out: string[] = []
    let start: string | null = null, prev: string | null = null, len = 0
    for (const f of flags) {
      if (f.flag) { if (start == null) { start = f.date; len = 1 } else len++; prev = f.date }
      else { if (start && len >= 3) out.push(`${start} bis ${prev} (${len} Tage)`); start = null; len = 0 }
    }
    if (start && len >= 3) out.push(`${start} bis ${prev} (${len} Tage)`)
    return out
  }
  const hrvRuns = runs(hrvBelowFlags)
  const rhrRuns = runs(rhrElevFlags)

  // ---- Build weekly table rows + traffic light ----
  const weekKeys = Object.keys(W).sort()
  const weekRows = weekKeys.map((k, i) => {
    const w = W[k]
    const stressMinTot = sum(w.stressMin)
    const restMinTot = sum(w.restMin)
    const ser = restMinTot > 0 ? round1(stressMinTot / restMinTot) : null
    const trainH = round1(w.trainMin / 60)
    // week-over-week volume delta (10% rule)
    const prev = i > 0 ? W[weekKeys[i - 1]] : null
    const prevH = prev ? prev.trainMin / 60 : null
    const volDeltaPct = prevH && prevH > 0 ? Math.round(((w.trainMin / 60 - prevH) / prevH) * 100) : null

    // signal count for traffic light (guide: 0=grün, 1-2=gelb, 3+=rot)
    let signals = 0
    if (w.hrvBelowDays >= 3) signals++
    if (w.rhrElevDays >= 3) signals++
    if (w.bbLowDays >= 1) signals++
    if (w.nightsShort >= 3) signals++
    if (ser != null && ser > 2) signals++
    if (volDeltaPct != null && volDeltaPct > 10) signals++
    const ampel = signals >= 3 ? '🔴' : signals >= 1 ? '🟡' : '🟢'

    return {
      k, w, ser, trainH, volDeltaPct, signals, ampel,
      hrvN: avg(w.hrvN), rhr: avg(w.rhr), sleepH: avg(w.sleepH), bb: avg(w.morningBB),
      sleepSD: sd(w.sleepMin), vo2: avg(w.vo2), acwr: avg(w.acwr),
    }
  })

  // ---- Development: first 4 weeks vs last 4 weeks ----
  const firstKeys = weekKeys.slice(0, 4)
  const lastKeys = weekKeys.slice(-4)
  function meanOver(keys: string[], pick: (w: Week) => number[]): number | null {
    const all = keys.flatMap((k) => pick(W[k]))
    return avg(all)
  }
  const dev = (label: string, pick: (w: Week) => number[], unit = '') => {
    const a = meanOver(firstKeys, pick)
    const b = meanOver(lastKeys, pick)
    const delta = a != null && b != null ? round1(b - a) : null
    return `${label}: erste 4 Wo. ${a ?? '—'}${unit} → letzte 4 Wo. ${b ?? '—'}${unit} (Δ ${delta ?? '—'}${unit})`
  }
  const devBlock = [
    dev('HRV (nächtl. Ø)', (w) => w.hrvN, ' ms'),
    dev('Ruhepuls', (w) => w.rhr, ' bpm'),
    dev('VO2max', (w) => w.vo2),
    dev('Schlaf', (w) => w.sleepH, ' h'),
    dev('Body Battery morgens', (w) => w.morningBB),
  ].join('\n')

  // ---- Text summaries ----
  const sleepSummary = weekRows
    .map((r) => `KW ${r.k}: hrv_nightly=${r.hrvN}, hrv_status=${r.w.hrvStatusLast ?? '—'}, ruhepuls=${r.rhr}, schlaf_h=${r.sleepH}, schlaf_konsistenz_sd_min=${r.sleepSD ?? '—'}, sleep_score=${avg(r.w.sleepScore)}, naechte_unter_6h=${r.w.nightsShort}`)
    .join('\n') || '(keine Daten)'

  // Activities weekly by type
  const actByWeekType: Record<string, { sessions: number; durationH: number[]; hrArr: number[]; distKm: number[]; speed: number[] }> = {}
  for (const row of activitiesRes.data ?? []) {
    const key = `${getWeekStart(row.date)}|${row.type ?? 'unbekannt'}`
    if (!actByWeekType[key]) actByWeekType[key] = { sessions: 0, durationH: [], hrArr: [], distKm: [], speed: [] }
    actByWeekType[key].sessions++
    if (row.duration_min != null) actByWeekType[key].durationH.push(row.duration_min / 60)
    if (row.avg_hr != null) actByWeekType[key].hrArr.push(row.avg_hr)
    if (row.distance_km != null) actByWeekType[key].distKm.push(row.distance_km)
    const sp = parseSpeed(row.avg_pace)
    if (sp != null) actByWeekType[key].speed.push(sp)
  }
  const actSummary = Object.entries(actByWeekType).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => {
      const [w, type] = key.split('|')
      return `KW ${w} ${type}: sessions=${d.sessions}, total_h=${round1(sum(d.durationH))}, total_km=${round1(sum(d.distKm))}, avg_hr=${avg(d.hrArr)}, avg_tempo_kmh=${avg(d.speed)}`
    }).join('\n') || '(keine Daten)'

  // Efficiency by duration bin (per type, whole window)
  function durationBin(min: number): string {
    if (min < 30) return 'kurz (<30min)'
    if (min <= 60) return 'mittel (30-60min)'
    return 'lang (>60min)'
  }
  const effByTypeBin: Record<string, { sessions: number; hrArr: number[]; speed: number[]; distKm: number[] }> = {}
  for (const row of activitiesRes.data ?? []) {
    if (row.duration_min == null) continue
    const key = `${row.type ?? 'unbekannt'}|${durationBin(row.duration_min)}`
    if (!effByTypeBin[key]) effByTypeBin[key] = { sessions: 0, hrArr: [], speed: [], distKm: [] }
    effByTypeBin[key].sessions++
    if (row.avg_hr != null) effByTypeBin[key].hrArr.push(row.avg_hr)
    if (row.distance_km != null) effByTypeBin[key].distKm.push(row.distance_km)
    const sp = parseSpeed(row.avg_pace)
    if (sp != null) effByTypeBin[key].speed.push(sp)
  }
  const effSummary = Object.entries(effByTypeBin).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => {
      const [type, bin] = key.split('|')
      return `${type} / ${bin}: n=${d.sessions}, avg_hr=${avg(d.hrArr)}, avg_tempo_kmh=${avg(d.speed)}, avg_dist_km=${avg(d.distKm)}`
    }).join('\n') || '(keine Daten)'

  const loadSummary = weekRows
    .map((r) => `KW ${r.k}: vo2max=${r.vo2}, atl=${avg(r.w.atl)}, ctl=${avg(r.w.ctl)}, acwr=${r.acwr}, train_h=${r.trainH}, vol_delta_vorwoche=${r.volDeltaPct != null ? r.volDeltaPct + '%' : '—'}, status=${r.w.statusPhraseLast ?? '—'}`)
    .join('\n') || '(keine Daten)'

  const stressSummary = weekRows
    .map((r) => `KW ${r.k}: stress_avg=${avg(r.w.stressAvg)}, stress_min=${sum(r.w.stressMin)}, erholungs_min=${sum(r.w.restMin)}, SER=${r.ser ?? '—'}, harte_tage=${r.w.hardDays}, ruhetage=${r.w.restDays}`)
    .join('\n') || '(keine Daten)'

  // Strength, habits, nutrition
  const strByWeek: Record<string, { sessions: number; intensities: number[] }> = {}
  for (const row of strengthRes.data ?? []) {
    const w = getWeekStart(row.date)
    if (!strByWeek[w]) strByWeek[w] = { sessions: 0, intensities: [] }
    strByWeek[w].sessions++
    strByWeek[w].intensities.push(row.intensity)
  }
  const strSummary = Object.entries(strByWeek).sort(([a], [b]) => a.localeCompare(b))
    .map(([w, d]) => `KW ${w}: sessions=${d.sessions}, avg_intensity=${avg(d.intensities)}`).join('\n') || '(keine Daten)'

  const habByWeekName: Record<string, { completed: number; total: number }> = {}
  for (const row of habitsRes.data ?? []) {
    const key = `${getWeekStart(row.date)}|${row.habit_name}`
    if (!habByWeekName[key]) habByWeekName[key] = { completed: 0, total: 0 }
    habByWeekName[key].total++
    if (row.completed) habByWeekName[key].completed++
  }
  const habSummary = Object.entries(habByWeekName).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => { const [w, habit] = key.split('|'); return `KW ${w} ${habit}: ${Math.round((100 * d.completed) / d.total)}%` })
    .join('\n') || '(keine Daten)'

  const nutByWeek: Record<string, { kcal: number[]; protein: number[]; days: number }> = {}
  for (const row of nutritionRes.data ?? []) {
    const w = getWeekStart(row.date)
    if (!nutByWeek[w]) nutByWeek[w] = { kcal: [], protein: [], days: 0 }
    nutByWeek[w].days++
    if (row.calories != null) nutByWeek[w].kcal.push(row.calories)
    if (row.protein_g != null) nutByWeek[w].protein.push(row.protein_g)
  }
  const nutSummary = Object.entries(nutByWeek).sort(([a], [b]) => a.localeCompare(b))
    .map(([w, d]) => `KW ${w}: avg_kcal=${avg(d.kcal)}, avg_protein_g=${avg(d.protein)}, logged_days=${d.days}`).join('\n') || '(keine Daten)'

  // Exams from calendar
  let examSummary = '(keine Prüfungen im Zeitraum)'
  try {
    const events = await fetchCalendarEvents(since, today)
    const exams = events.filter((e) => isExamEvent(e.title))
    if (exams.length) {
      examSummary = exams.map((e) => { const d = e.start.slice(0, 10); return `KW ${getWeekStart(d)} (${d}): ${e.title}` }).join('\n')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[analyse] calendar fetch error:', msg)
    examSummary = '(Kalender nicht erreichbar)'
  }

  // 12-week table (precomputed, deterministic)
  const tableRows = weekRows
    .map((r) => `| ${r.k} | ${r.hrvN ?? '—'} | ${r.rhr ?? '—'} | ${r.sleepH ?? '—'} | ${r.bb ?? '—'} | ${r.trainH} | ${r.ser ?? '—'} | ${r.ampel} |`)
    .join('\n')

  const warnBlock = [
    `HRV 3+ Tage unter Baseline: ${hrvRuns.length ? hrvRuns.join('; ') : 'keine'}`,
    `Ruhepuls +5bpm über 7-Tage-Mittel, 3+ Tage: ${rhrRuns.length ? rhrRuns.join('; ') : 'keine'}`,
    `Wochen mit Body Battery morgens <30 (mind. 1 Tag): ${weekRows.filter((r) => r.w.bbLowDays > 0).map((r) => r.k).join(', ') || 'keine'}`,
    `Wochen mit ≥3 Nächten <6h Schlaf: ${weekRows.filter((r) => r.w.nightsShort >= 3).map((r) => r.k).join(', ') || 'keine'}`,
    `Wochen mit SER >2 (kritisch): ${weekRows.filter((r) => r.ser != null && r.ser > 2).map((r) => r.k).join(', ') || 'keine'}`,
    `Wochen mit Volumensteigerung >10%: ${weekRows.filter((r) => r.volDeltaPct != null && r.volDeltaPct > 10).map((r) => `${r.k} (+${r.volDeltaPct}%)`).join(', ') || 'keine'}`,
  ].join('\n')

  const dataBlock = `=== ANALYSEDATEN (${weeks} Wochen ab ${sinceStr}) ===
Hinweis: Alle Werte sind bereits vor-aggregiert. HRV-Baseline & -Status stammen direkt von Garmin (rollierend, personalisiert), nicht selbst berechnet.

SCHLAF & ERHOLUNG (wöchentlich):
${sleepSummary}

AKTIVITÄTEN (wöchentlich nach Typ):
${actSummary}

EFFIZIENZ NACH AKTIVITÄTSLÄNGE (pro Sportart, ganzer Zeitraum — Puls/Tempo kurz vs. lang):
${effSummary}

TRAINING LOAD & FITNESS (wöchentlich — ATL=akute Last, CTL=chronische Last, ACWR=akut:chronisch-Quote, Ziel 0.8–1.3):
${loadSummary}

STRESS & BELASTUNG (wöchentlich — SER=Stress-/Erholungs-Minuten):
${stressSummary}

KRAFTTRAINING:
${strSummary}

GEWOHNHEITEN (Erfüllungsrate):
${habSummary}

ERNÄHRUNG:
${nutSummary}

ENTWICKLUNG (erste 4 Wochen vs. letzte 4 Wochen):
${devBlock}

WARNSIGNALE (vorab erkannt nach Leitfaden-Schwellen):
${warnBlock}

PRÜFUNGSWOCHEN (akademische Belastung — korreliere Erholung/Stress/Training drumherum):
${examSummary}

12-WOCHEN-TABELLE (bereits berechnet — übernimm sie unverändert):
| KW | Ø HRV | Ø RHR | Ø Schlaf(h) | Ø BB | Train-h | SER | Ampel |
|----|-------|-------|-------------|------|---------|-----|-------|
${tableRows}`

  const systemPrompt = `Du bist ein persönlicher Performance-Analyst und arbeitest streng nach dem Garmin-Analyse-Leitfaden des Nutzers. Analysiere die vor-aggregierten Daten, finde echte Muster und Korrelationen. Sei konkret, datenbasiert, kein Hedging. Antworte auf Deutsch.

Leitfaden-Grundprinzipien:
- Trends schlagen Absolutwerte. Bewerte 7-Tage-/Wochenmittel und Richtung über Zeit, nie einzelne Tage.
- Persönliche Baseline vor Normwerten. Für HRV gilt Garmins nativer Status (BALANCED/UNBALANCED/LOW) und der balanced-Korridor als Referenz — nutze hrv_status, nicht Internet-Normwerte.
- Kontext: niedrige HRV/erhöhter RHR direkt nach harter Einheit oder in Prüfungswochen ist erwartbar.

Leitfaden-Korrelationen, die du prüfen sollst:
- HRV unter Baseline (status≠BALANCED) → harte Einheit verschlechtert Erholung 24–48h → nur Zone 1–2.
- Ruhepuls +5 bpm über 3+ Tage über 7-Tage-Mittel → kumulative Erschöpfung → Volumen 30% senken.
- Schlaf-Score <60 → Body Battery morgens niedrig → kein Intensitätstraining.
- Hoher Stress (Ø >60 / hohe Stress-Minuten) → schlechtere Nacht-HRV.
- Puls bei gleicher Pace sinkend → steigende aerobe Fitness (nutze "Effizienz nach Aktivitätslänge" + Tempo/HF-Trend).
- ACWR 0.8–1.3 = optimaler Bereich; >1.5 = erhöhtes Überlastungsrisiko.
- 10%-Regel: Trainingsvolumen sollte wöchentlich nicht >10% steigen.
- Schlafkonsistenz: SD der Schlafdauer <45 min ist Ziel.

Warnsignale (Handlung vor Analyse): HRV 3+ Tage unter Baseline, RHR +5bpm/3 Tage, Body Battery morgens <30, ≥3 Nächte <6h, SER >2, ACWR >1.5. Zwei oder mehr gleichzeitig in einer Woche → Erholung priorisieren.

Gib die Analyse als Markdown mit GENAU diesen Abschnitten aus:
## Erholung & Schlaf
(HRV-Status & -Trend vs. Garmin-Baseline, Ruhepuls-Trend, Schlafdauer & -konsistenz)
## Training & Fortschritt
(Tempo/HF-Entwicklung, Effizienz nach Länge, VO2max-Trend, ATL/CTL/ACWR-Bewertung, 10%-Regel)
## Stress & Belastung
(SER, Stress-Minuten, Zusammenhang mit Prüfungswochen)
## Warnsignale & Wochen-Ampel
(konkrete Signale aus dem WARNSIGNALE-Block benennen; die Ampel-Wertung der 12-Wochen-Tabelle interpretieren)
## 12-Wochen-Übersicht
(übernimm die vorberechnete Tabelle UNVERÄNDERT und kommentiere die Entwicklung erste vs. letzte 4 Wochen)
## Empfehlungen
(3 konkrete, datenbasierte Empfehlungen für die nächsten Wochen)`

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: dataBlock }],
        })

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const chunk = event.delta.text
            fullText += chunk
            controller.enqueue(encoder.encode(chunk))
          }
        }

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
          .then(({ error }) => { if (error) console.error('[analyse] save knowledge error:', error) })

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

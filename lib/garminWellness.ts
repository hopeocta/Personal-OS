import type { GarminConnect } from 'garmin-connect'

// Garmin's dailyStress endpoint isn't wrapped by the package — call it via the
// generic client.get. Returns daily average + max stress for the given date.
// Garmin uses negative sentinels (-1, -2) when no stress data exists; we map
// those to null so the DB stores "no reading" rather than a fake value.
export async function fetchDailyStress(
  client: GarminConnect,
  date: Date
): Promise<{ avgStress: number | null; maxStress: number | null }> {
  const dateStr = date.toISOString().split('T')[0]
  const url = `https://connectapi.garmin.com/wellness-service/wellness/dailyStress/${dateStr}`

  const data = await client.get<{
    avgStressLevel?: number | null
    maxStressLevel?: number | null
  }>(url)

  const clean = (v: number | null | undefined): number | null =>
    v == null || v < 0 ? null : v

  return {
    avgStress: clean(data?.avgStressLevel),
    maxStress: clean(data?.maxStressLevel),
  }
}

// HRV-Baseline & Status (Garmin-nativ). Garmin pflegt eine rollierende,
// personalisierte Baseline (balanced-Korridor) — wir übernehmen sie direkt,
// statt eine eigene 4-Wochen-Baseline zu rechnen.
export async function fetchHrvSummary(
  client: GarminConnect,
  date: Date
): Promise<{
  status: string | null
  baselineLow: number | null
  baselineHigh: number | null
  weeklyAvg: number | null
}> {
  const ds = date.toISOString().split('T')[0]
  const url = `https://connectapi.garmin.com/hrv-service/hrv/${ds}`
  const data = await client.get<{
    hrvSummary?: {
      status?: string | null
      weeklyAvg?: number | null
      baseline?: { balancedLow?: number | null; balancedUpper?: number | null }
    }
  }>(url)
  const s = data?.hrvSummary
  return {
    status: s?.status ?? null,
    baselineLow: s?.baseline?.balancedLow ?? null,
    baselineHigh: s?.baseline?.balancedUpper ?? null,
    weeklyAvg: s?.weeklyAvg ?? null,
  }
}

// Tages-Summary: Stress-Minuten-Aufschlüsselung (für die Stress-Erholungs-Quote)
// und der 7-Tage-Ruhepuls. Garmin liefert Dauern in Sekunden → wir geben Minuten zurück.
// Braucht den displayName (User-Hash), den die Route einmalig per getUserProfile holt.
export async function fetchDailySummary(
  client: GarminConnect,
  date: Date,
  displayName: string
): Promise<{
  stressMinLow: number | null
  stressMinMed: number | null
  stressMinHigh: number | null
  restMin: number | null
  rhr7day: number | null
}> {
  const ds = date.toISOString().split('T')[0]
  const url = `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${displayName}?calendarDate=${ds}`
  const data = await client.get<{
    lowStressDuration?: number | null
    mediumStressDuration?: number | null
    highStressDuration?: number | null
    restStressDuration?: number | null
    lastSevenDaysAvgRestingHeartRate?: number | null
  }>(url)
  const toMin = (s: number | null | undefined): number | null =>
    s == null || s < 0 ? null : Math.round(s / 60)
  return {
    stressMinLow: toMin(data?.lowStressDuration),
    stressMinMed: toMin(data?.mediumStressDuration),
    stressMinHigh: toMin(data?.highStressDuration),
    restMin: toMin(data?.restStressDuration),
    rhr7day: data?.lastSevenDaysAvgRestingHeartRate ?? null,
  }
}

// Training Status: akute/chronische Last (ATL/CTL), ACWR (Belastungsquote),
// Garmin-Trainingsstatus und VO2max — alles in einem Request.
export async function fetchTrainingStatus(
  client: GarminConnect,
  date: Date
): Promise<{
  vo2max: number | null
  atl: number | null
  ctl: number | null
  acwr: number | null
  acwrStatus: string | null
  trainingStatus: number | null
  statusPhrase: string | null
}> {
  const ds = date.toISOString().split('T')[0]
  const url = `https://connectapi.garmin.com/metrics-service/metrics/trainingstatus/aggregated/${ds}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await client.get<any>(url)

  const vo2max = data?.mostRecentVO2Max?.generic?.vo2MaxValue ?? null

  // Status & akute Last hängen am primären Gerät — erstes Gerät mit primaryTrainingDevice.
  const tsMap = data?.mostRecentTrainingStatus?.latestTrainingStatusData ?? {}
  const tsEntry =
    Object.values(tsMap).find((v: unknown) => (v as { primaryTrainingDevice?: boolean })?.primaryTrainingDevice) ??
    Object.values(tsMap)[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts = tsEntry as any
  const acute = ts?.acuteTrainingLoadDTO ?? {}

  return {
    vo2max,
    atl: acute?.dailyTrainingLoadAcute ?? null,
    ctl: acute?.dailyTrainingLoadChronic ?? null,
    acwr: acute?.dailyAcuteChronicWorkloadRatio ?? null,
    acwrStatus: acute?.acwrStatus ?? null,
    trainingStatus: ts?.trainingStatus ?? null,
    statusPhrase: ts?.trainingStatusFeedbackPhrase ?? null,
  }
}

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

import { NextRequest, NextResponse } from 'next/server'
import { getGarminClient } from '@/lib/garminClient'

export const maxDuration = 30

// Returns a simplified GPS polyline for a single activity.
// Garmin's /details endpoint includes geoPolylineDTO alongside the metric
// time-series. Indoor activities (pool swim, trainer) return {points:[], hasGPS:false}.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let client
  try {
    client = await getGarminClient('me')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Auth: ${msg}` }, { status: 500 })
  }

  try {
    const url = `https://connectapi.garmin.com/activity-service/activity/${id}/details?maxChartSize=2000`
    const data = await client.get<{
      geoPolylineDTO?: {
        polyline?: Array<{ lat: number; lon: number; altitude?: number }>
      }
    }>(url)

    const polyline = data?.geoPolylineDTO?.polyline ?? []

    if (polyline.length === 0) {
      return NextResponse.json({ points: [], hasGPS: false })
    }

    // Thin to ≤300 points to keep the SVG path reasonably small
    const step = Math.max(1, Math.ceil(polyline.length / 300))
    const points = polyline
      .filter((_, i) => i % step === 0)
      .map(({ lat, lon }) => ({ lat, lon }))

    return NextResponse.json({ points, hasGPS: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[activity-route] GPS fetch error:', msg)
    // Graceful fallback — caller renders "Keine GPS-Strecke"
    return NextResponse.json({ points: [], hasGPS: false })
  }
}

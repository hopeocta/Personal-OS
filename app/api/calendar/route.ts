import { NextRequest, NextResponse } from 'next/server'
import type { CalendarEvent } from '@/lib/types'
import { fetchCalendarEvents } from '@/lib/calendar'

export const runtime = 'nodejs'

const cacheMap = new Map<string, { events: CalendarEvent[]; fetchedAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const fromParam = sp.get('from')
  const toParam = sp.get('to')

  // Range mode: explicit from/to (YYYY-MM-DD) — includes past events.
  // Default mode: future-only window of N days from now (used by the home card).
  let rangeStart: Date
  let rangeEnd: Date
  let cacheKey: string

  if (fromParam && toParam) {
    rangeStart = new Date(`${fromParam}T00:00:00.000Z`)
    rangeEnd = new Date(`${toParam}T23:59:59.999Z`)
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return NextResponse.json(
        { error: 'Invalid from/to — expected YYYY-MM-DD' },
        { status: 400 }
      )
    }
    cacheKey = `range:${fromParam}|${toParam}`
  } else {
    const daysParam = sp.get('days')
    const windowDays = daysParam ? Math.min(parseInt(daysParam), 365) : 14
    rangeStart = new Date()
    rangeEnd = new Date()
    rangeEnd.setDate(rangeEnd.getDate() + windowDays)
    cacheKey = `days:${windowDays}`
  }

  const cached = cacheMap.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cached.events, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  let events: CalendarEvent[]
  try {
    events = await fetchCalendarEvents(rangeStart, rangeEnd)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Calendar fetch/parse error:', msg)
    return NextResponse.json({ error: `Calendar error: ${msg}` }, { status: 502 })
  }

  cacheMap.set(cacheKey, { events, fetchedAt: Date.now() })

  return NextResponse.json(events, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

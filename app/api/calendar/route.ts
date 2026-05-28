import { NextRequest, NextResponse } from 'next/server'
import ICAL from 'ical.js'
import type { CalendarEvent } from '@/lib/types'

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

  const url = process.env.GOOGLE_CALENDAR_ICAL_URL
  if (!url) {
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  let text: string
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    text = await res.text()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Calendar fetch error:', msg)
    return NextResponse.json({ error: `Failed to fetch calendar: ${msg}` }, { status: 502 })
  }

  const events: CalendarEvent[] = []

  try {
    const parsed = ICAL.parse(text)
    const comp = new ICAL.Component(parsed)
    const vevents = comp.getAllSubcomponents('vevent')

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent)

      if (event.isRecurring()) {
        const iter = event.iterator()
        let next = iter.next()
        let safety = 0
        while (next && safety < 1000) {
          safety++
          const start = next.toJSDate()
          if (start > rangeEnd) break
          if (start >= rangeStart) {
            const durMs = event.duration.toSeconds() * 1000
            events.push({
              id: `${event.uid}-${next.toString()}`,
              title: event.summary ?? '(kein Titel)',
              start: start.toISOString(),
              end: new Date(start.getTime() + durMs).toISOString(),
              allDay: event.startDate.isDate,
              description: event.description ?? null,
              location: event.location ?? null,
            })
          }
          next = iter.next()
        }
      } else {
        const start = event.startDate.toJSDate()
        const end = event.endDate?.toJSDate() ?? start
        if (start >= rangeStart && start <= rangeEnd) {
          events.push({
            id: event.uid ?? `ev-${start.getTime()}`,
            title: event.summary ?? '(kein Titel)',
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: event.startDate.isDate,
            description: event.description ?? null,
            location: event.location ?? null,
          })
        }
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Calendar parse error:', msg)
    return NextResponse.json({ error: `Calendar parse error: ${msg}` }, { status: 500 })
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  cacheMap.set(cacheKey, { events, fetchedAt: Date.now() })

  return NextResponse.json(events, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

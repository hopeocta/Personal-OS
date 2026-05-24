import { NextRequest, NextResponse } from 'next/server'
import ICAL from 'ical.js'
import type { CalendarEvent } from '@/lib/types'

export const runtime = 'nodejs'

const cacheMap = new Map<number, { events: CalendarEvent[]; fetchedAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get('days')
  const windowDays = daysParam ? Math.min(parseInt(daysParam), 365) : 14

  const cached = cacheMap.get(windowDays)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cached.events, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const url = process.env.GOOGLE_CALENDAR_ICAL_URL
  if (!url) {
    return NextResponse.json({ error: 'GOOGLE_CALENDAR_ICAL_URL not configured' }, { status: 500 })
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

  const now = new Date()
  const windowEnd = new Date(now)
  windowEnd.setDate(windowEnd.getDate() + windowDays)

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
        while (next && safety < 200) {
          safety++
          const start = next.toJSDate()
          if (start > windowEnd) break
          if (start >= now) {
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
        if (start >= now && start <= windowEnd) {
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
  cacheMap.set(windowDays, { events, fetchedAt: Date.now() })

  return NextResponse.json(events, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

import ICAL from 'ical.js'
import type { CalendarEvent } from '@/lib/types'

const EXAM_KEYWORDS = ['prüfung', 'klausur', 'osce', 'testat', 'exam', 'examen']

// True if the event title looks like an exam/assessment.
export function isExamEvent(title: string): boolean {
  const t = title.toLowerCase()
  return EXAM_KEYWORDS.some((kw) => t.includes(kw))
}

// Fetches and expands calendar events within [rangeStart, rangeEnd] from the
// iCal feed. Works for both past and future ranges. Returns [] if no feed URL.
// Throws on fetch/parse errors so callers can surface them.
export async function fetchCalendarEvents(
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const url = process.env.GOOGLE_CALENDAR_ICAL_URL
  if (!url) return []

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()

  const events: CalendarEvent[] = []
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

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  return events
}

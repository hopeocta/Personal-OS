import ICAL from 'ical.js'
import type { CalendarEvent } from '@/lib/types'

const EXAM_KEYWORDS = ['prüfung', 'klausur', 'osce', 'testat', 'exam', 'examen']

// True if the event title looks like an exam/assessment.
export function isExamEvent(title: string): boolean {
  const t = title.toLowerCase()
  return EXAM_KEYWORDS.some((kw) => t.includes(kw))
}

// Stichwörter, an denen ein Kalender-Termin als Trainingseinheit erkannt wird.
// Bewusst breit (DE+EN). Bei Fehltreffern/Lücken hier anpassen.
const TRAINING_KEYWORDS = [
  'schwimm', 'kraul', 'lauf', 'run', 'jog', 'rad', 'bike', 'cycl', 'velo', 'spinning',
  'kraft', 'gym', 'workout', 'training', 'triathlon', 'intervall', 'tempo', 'long run',
]

// True, wenn der Termin-Titel nach einer Trainingseinheit aussieht.
export function isTrainingEvent(title: string): boolean {
  const t = title.toLowerCase()
  return TRAINING_KEYWORDS.some((kw) => t.includes(kw))
}

// Fetches and expands calendar events from a single iCal URL within [rangeStart, rangeEnd].
// Returns [] if the URL is empty. Throws on fetch/parse errors.
async function fetchFromIcalUrl(
  url: string,
  rangeStart: Date,
  rangeEnd: Date,
  sourcePrefix = ''
): Promise<CalendarEvent[]> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
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
            id: `${sourcePrefix}${event.uid}-${next.toString()}`,
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
          id: `${sourcePrefix}${event.uid ?? `ev-${start.getTime()}`}`,
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

  return events
}

// Fetches and expands calendar events within [rangeStart, rangeEnd] from all
// configured iCal feeds:
//   GOOGLE_CALENDAR_ICAL_URL  — primary Google Calendar (Hauptkalender)
//   GARMIN_ICAL_URL           — Garmin Connect iCal-Export
// Both env vars are optional; only populated feeds are fetched.
// Throws on fetch/parse errors so callers can surface them.
export async function fetchCalendarEvents(
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const sources: Array<{ url: string; prefix: string }> = []

  const primaryUrl = process.env.GOOGLE_CALENDAR_ICAL_URL
  if (primaryUrl) sources.push({ url: primaryUrl, prefix: '' })

  const garminUrl = process.env.GARMIN_ICAL_URL
  if (garminUrl) sources.push({ url: garminUrl, prefix: 'garmin-' })

  if (sources.length === 0) return []

  const results = await Promise.allSettled(
    sources.map(({ url, prefix }) => fetchFromIcalUrl(url, rangeStart, rangeEnd, prefix))
  )

  const events: CalendarEvent[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      events.push(...result.value)
    } else {
      console.error('[calendar] iCal-Fehler:', result.reason)
    }
  }

  // Deduplizierung per ID, dann nach Startzeit sortieren
  const seen = new Set<string>()
  const unique = events.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  unique.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  return unique
}

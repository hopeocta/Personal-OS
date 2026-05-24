import { google } from 'googleapis'

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY ist nicht gesetzt')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
}

export async function createCalendarEvent(params: {
  title: string
  startIso: string
  endIso: string | null
  reminderMinutes: number | null
}): Promise<void> {
  const auth = getAuth()
  const calendar = google.calendar({ version: 'v3', auth })
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary'

  // Default-Dauer 1 Stunde wenn kein Ende angegeben
  const endIso =
    params.endIso ??
    new Date(new Date(params.startIso).getTime() + 60 * 60 * 1000).toISOString()

  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: params.title,
      start: { dateTime: params.startIso, timeZone: 'Europe/Berlin' },
      end: { dateTime: endIso, timeZone: 'Europe/Berlin' },
      reminders:
        params.reminderMinutes !== null
          ? {
              useDefault: false,
              overrides: [{ method: 'popup', minutes: params.reminderMinutes }],
            }
          : { useDefault: true },
    },
  })
}

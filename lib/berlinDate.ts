/** Datums-Helfer in Europe/Berlin (oder USER_TIMEZONE). */

export function berlinTz(): string {
  return process.env.USER_TIMEZONE ?? 'Europe/Berlin'
}

/** Heutiges Datum als YYYY-MM-DD in der Nutzer-Zeitzone. */
export function berlinDateKey(offsetDays = 0): string {
  const shifted = new Date(Date.now() + offsetDays * 86400000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: berlinTz(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted)
}

/** Wochentag 0=So … 6=Sa in Berlin. */
export function berlinWeekday(dateKey?: string): number {
  const key = dateKey ?? berlinDateKey()
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: berlinTz(),
    weekday: 'short',
  }).format(new Date(`${key}T12:00:00`))
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return map[label] ?? 0
}

/** ISO-Kalenderwoche (z. B. 2026-W23). */
export function isoWeekKey(date = new Date()): string {
  const tz = berlinTz()
  const local = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date))
  local.setDate(local.getDate() + 4 - (local.getDay() || 7))
  const yearStart = new Date(local.getFullYear(), 0, 1)
  const week = Math.ceil(((local.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${local.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Montag–Sonntag der ISO-Woche als YYYY-MM-DD. */
export function isoWeekRange(weekKey: string): { from: string; to: string } {
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = Number(yearStr)
  const week = Number(weekStr)
  const jan4 = new Date(year, 0, 4)
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: fmt(monday), to: fmt(sunday) }
}

/** Lesbares deutsches Datum (z. B. „Donnerstag, 4. Juni 2026“). */
export function germanLongDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`)
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: berlinTz(),
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

Zuletzt abgeschlossen: Abend 3 — Garmin Sync + Google Calendar
Nächster Schritt: Abend 4 — Home Dashboard: Sleep + Habits + Nutrition live verbinden
Datum: 2026-05-23
Offene Punkte:
- Garmin-Sync testen: nach Vercel-Deploy einmalig manuell aufrufen mit
  curl -H "Authorization: Bearer $CRON_SECRET" https://DEINE-URL.vercel.app/api/garmin/sync
- Danach läuft der Cron täglich um 5:00 UTC automatisch
- Kalender funktioniert lokal nicht (GOOGLE_CALENDAR_ICAL_URL nur in Vercel) — ist korrekt so

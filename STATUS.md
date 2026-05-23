Zuletzt abgeschlossen: Abend 3 — Garmin Sync + Google Calendar + Backfill
Nächster Schritt: Abend 4 — Home Dashboard: Sleep + Habits + Nutrition live verbinden
Datum: 2026-05-23
Offene Punkte: keine

Zusätzlich erledigt (außerhalb Abend 3):
- Middleware fix: /api/garmin/*, /api/calendar/*, /api/telegram/* von Cookie-Auth ausgenommen
- Garmin Backfill: 357 Aktivitäten der letzten 12 Monate in Supabase importiert
- Täglicher Cron läuft (05:00 UTC), CRON_SECRET = meincoolerkey00
- Produktions-URL: personal-os-ten-iota.vercel.app (Vercel Auth noch aktiv auf personal-os.vercel.app)
- Hash-URLs für API-Tests funktionieren ohne Vercel Auth

Zuletzt abgeschlossen: Abend 5 — Training Section live
Nächster Schritt: Abend 6 — Wissen & Recherche (Knowledge Capture + Obsidian)
Datum: 2026-05-23
Offene Punkte: ANTHROPIC_API_KEY in .env.local eintragen (für Claude Haiku in Abend 6)

Was gebaut wurde (Abend 5):
- /api/strength (GET + POST): strength_sessions lesen/schreiben
- /api/training/summary (GET): Garmin-Aktivitäten aggregiert mit swimKm/bikeKm/runKm/totalHours + Rohliste
- TrainingWeekLive: echte Wochenübersicht (Garmin vs. Kalender), DONE/AUSSTEHEND/VERPASST/EXTRA Badges
- TriathlonHistory: 30-Tage Aktivitätsliste, 5 Filter, aufklappbare Detail-Ansicht
- StrengthLogger: vollständig mit API verbunden, GESPEICHERT ✓ Feedback, lädt letzte 5 Sessions
- app/training/page.tsx: neue Training-Section unter /training

Vor Abend 6 manuell erledigen:
- ANTHROPIC_API_KEY= in .env.local (Anthropic Console → API Keys)
- OBSIDIAN_API_URL= und OBSIDIAN_API_KEY= (Obsidian → Community Plugins → Local REST API)
- Obsidian Ordnerstruktur anlegen (siehe CLAUDE.md "NACH DEM BUILD")

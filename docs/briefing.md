# Briefing & Wochen-Training

Automatische Zusammenfassungen, die morgens per Telegram kommen und auf dem Dashboard
(`BriefingCard`) erscheinen. **Kein Claude-Call** — reine Supabase-/Kalender-Aggregation.

---

## Morgen-Briefing

`lib/briefing.ts` → `buildMorningBriefing(dateKey)` baut zwei Ausgaben (Markdown fürs
Dashboard/Obsidian, kompakter Text für Telegram). Abschnitte:

1. **Schlaf & Erholung** — Schlaf-Score, HRV (+ 7-Tage-Ø-Vergleich), Schlafdauer, Body Battery,
   HRV-Status, ACWR. Fällt auf den Vortag zurück, falls die letzte Nacht noch nicht gesynct ist.
2. **Heute** — Kalender-Events des Tages (`fetchCalendarEvents`), Prüfungen mit ⚠️.
3. **Training (7 Tage)** — Triathlon-Summe + „Gestern" + **Nächste Einheit** (nächster
   Trainings-Termin aus dem Kalender via `isTrainingEvent`).
4. **Heute dran** — heute fällige Aufgaben (`lib/tasks.ts` → `dueTasks`).

> Schlaf hängt zur Briefing-Zeit ggf. eine Nacht hinterher → Garmin-Cron + Briefing wurden
> auf 6:00 / 6:10 UTC (8:00 / 8:10 Berlin Sommer) verschoben. Siehe [garmin-sync.md](garmin-sync.md).

**Speichern:** `lib/briefingStore.ts` → `knowledge_entries` (source `morning_briefing`) +
Obsidian `Logbuch/Zusammenfassungen/<tag>-briefing.md` (Letzteres nur lokal erreichbar →
[obsidian.md](obsidian.md)).

---

## Wochen-Training

`lib/weeklyTraining.ts` → `buildWeeklyTrainingSummary(weekKey)`: Triathlon-Wochenbilanz
(Einheiten, Stunden, km je Disziplin) + ACWR. Speicherung als `weekly_training` +
`Logbuch/Wochen/<woche>-training.md`.

---

## Auslöser

| Weg | Route | Zeit |
|---|---|---|
| Telegram Morgen-Briefing | `GET /api/telegram/briefing?type=morning` | Cron **6:10 UTC** |
| Telegram Wochen-Training | `GET /api/telegram/briefing?type=weekly-training` | Cron **Mo 6:20 UTC** |
| Dashboard-Karte | `GET /api/briefing/today` → `BriefingCard` | beim Laden von `/` |

Alle Cron-Routen prüfen `Authorization: Bearer CRON_SECRET`.

---

## Dateien

`lib/briefing.ts`, `lib/weeklyTraining.ts`, `lib/briefingStore.ts`,
`app/api/telegram/briefing/route.ts`, `app/api/briefing/today/route.ts`,
`components/dashboard/BriefingCard.tsx`.

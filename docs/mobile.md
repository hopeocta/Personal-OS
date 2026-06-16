# Mobile-App `/m`

PWA-fähige Handy-Oberfläche unter `/m`. Auto-Redirect für mobile User-Agents (Ausstieg via `?desktop=1`).

---

## Architektur

| Schicht | Details |
|---|---|
| Route | `app/m/` — eigenes Layout mit Bottom-Nav |
| Layout | `app/m/layout.tsx` (Client) — `height:100dvh`, nur `main` scrollt, Nav + Masthead fix |
| Tabs | Heute (`/m`), Erfassen (`/m/erfassen`), Hermes (`/m/hermes`) |
| PWA | `app/manifest.ts`, Icons `public/icon-192/512.png`, `apple-touch-icon.png` |

---

## Komponenten

### `MNextTraining` — Nächste Trainings
- Fetcht parallel `/api/training/plan?days=14` (plan-Sessions) + `/api/calendar?days=14` (Kalender-Events)
- Kalender-Events werden auf Lauf-Keywords gefiltert (`run`, `lauf`, `jog`, `marathon`, `pace`, `easy`, `tempo run` …) → Runna-Läufe aus Garmin-iCal
- **RUNNA-Badge**: calendar-Läufe sind `locked: true` → kein Verschieben, kein Detail-Toggle
- **Datum-Fix**: AllDay-Events aus Garmin-iCal kommen als UTC-Mitternacht (z.B. `2026-06-16T22:00Z` für DE-Termin am 17.6.) → `toLocaleDateString('en-CA')` gibt korrektes Berliner Datum
- **Details aus Runna-Titeln**: `description` ist im iCal null → Distanz per Regex `\((\d+[,.]\d*) km\)` extrahiert, Workout-Typ aus Titelformat `… - <Typ> (<Distanz>)` als Fallback
- **Touch-Targets**: Padding 14px, Titel 0.9rem, Mindesthöhe 52px
- **Verschieben** (nur plan-Sessions): `← -1` / `+1 →` im Detail-View → `PATCH /api/training/session`
- **Rad Indoor/Outdoor-Toggle**: zeigt `watts_indoor` vs. HF/Tempo je nach Modus

### `MTraining` — Training letzte 7 Tage
- Fetcht `/api/training/summary?days=7`
- Nutzt **API-berechnete Totals** (`swimKm`, `bikeKm`, `runKm`) statt client-seitig neu zu rechnen
- `multi_sport`-Aktivitäten werden in der Summary-API über `triathlon_races`-Splits aufgeteilt (korrekte Swim/Bike/Run-km)
- `actSport()` erkennt `multi_sport` → `brick`-Farbe in der Aktivitätsliste

### `MSleepRing` — Schlaf & Erholung
- Score-Ring (grün ≥ 80 / gelb ≥ 60 / rot < 60), HRV, Schlafdauer, Tiefschlaf, Body Battery

### `MTasks` — Heute dran
- Recurring Tasks aus `/api/tasks`, abhaken in-place

---

## API-Routen

### `GET /api/training/plan?days=N`
- Liest `training_plan_sessions` ab heute für N Tage
- Sortiert nach `date`, `sort_order`

### `PATCH /api/training/session`
- Body: `{ id: string, date: string }` (YYYY-MM-DD)
- Verschiebt `training_plan_sessions.date` für eine Einheit
- Nur für plan-Sessions, nicht für Runna/Kalender-Events

### `GET /api/training/summary?days=N`
- Liest `garmin_activities` + `triathlon_races` parallel
- `multi_sport`-Aktivitäten: Splits aus `triathlon_races` (gleiche Date) → swim/bike/run getrennt
- Gibt `{ swimKm, bikeKm, runKm, totalHours, activities }` zurück

---

## Datenquellen für Trainingsplan

| Quelle | Sport | Wie |
|---|---|---|
| `training_plan_sessions` (source=plan) | swim, bike, strength, rest | `/api/training/plan` |
| Garmin-iCal (`GARMIN_ICAL_URL`) via `/api/calendar` | run (Runna) | Lauf-Keyword-Filter, `locked: true` |
| `triathlon_races` | swim/bike/run splits | Nur für multi_sport-Summary-Berechnung |

---

## Hinweise
- Garmin-iCal AllDay-Events: UTC-Mitternacht = Berliner Datum vom Folgetag → immer `toLocaleDateString('en-CA')` statt `.slice(0,10)` für allDay-Events
- Runna sendet keine `description` im iCal — Details kommen aus Titel-Parsing
- `multi_sport` in `garmin_activities` hat nur Gesamtdistanz; Splits kommen aus `triathlon_races` (muss manuell befüllt sein)
